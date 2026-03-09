import { useState, useCallback, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Chip } from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useSip } from '../context/SipContext';
import api from '../utils/api';

export default function SoftphoneWidget() {
  const { user } = useAuth();
  const sip = useSip();
  const [number, setNumber] = useState('');
  const [callState, setCallState] = useState('idle'); // idle | dialing | ringing
  const [activeCallId, setActiveCallId] = useState(null);
  const [error, setError] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferDest, setTransferDest] = useState('');
  const [transferType, setTransferType] = useState('blind');
  const [transferLoading, setTransferLoading] = useState(false);

  const sipConnected = sip?.enabled && (sip?.state === 'connected' || sip?.state === 'calling');
  const sipInCall = sipConnected;
  const [callDuration, setCallDuration] = useState(0);

  // SIP state 'registered'/'disconnected' olduğunda local callState'i de sıfırla
  // Bu, çağrı düştüğünde veya bağlantı koptuğunda UI'ın takılı kalmasını engeller
  useEffect(() => {
    if (!sipInCall && sip?.state !== 'incoming' && callState !== 'idle') {
      // SIP artık aramada değil ama callState henüz sıfırlanmamış
      const timeout = setTimeout(() => {
        if (!sipInCall && callState !== 'idle') {
          console.log('[Softphone] SIP arama bitti, callState sıfırlanıyor');
          setCallState('idle');
          setActiveCallId(null);
        }
      }, 2000); // 2sn tolerans — arama kurulumu sırasında erken tetiklenmesin
      return () => clearTimeout(timeout);
    }
  }, [sipInCall, sip?.state, callState]);

  useEffect(() => {
    if (!sipInCall) {
      setCallDuration(0);
      return;
    }
    const start = Date.now();
    const iv = setInterval(() => setCallDuration(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [sipInCall]);

  useEffect(() => {
    if (!activeCallId || callState === 'idle' || sipInCall) return;

    let cancelled = false;
    const syncActiveCall = async () => {
      try {
        const res = await api.get('/calls/me/active');
        const active = res?.data?.id ? res.data : null;
        const stillActive =
          active &&
          active.id === activeCallId &&
          ['initiating', 'ringing', 'connected'].includes(String(active.status || '').toLowerCase());

        if (!stillActive && !cancelled) {
          setCallState('idle');
          setActiveCallId(null);
        }
      } catch {
        if (!cancelled) {
          setCallState('idle');
          setActiveCallId(null);
        }
      }
    };

    syncActiveCall();
    const interval = setInterval(syncActiveCall, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeCallId, callState, sipInCall]);

  const handleCall = async () => {
    const num = number.replace(/\D/g, '');
    if (!num || !user?.extension) return;
    const isInternalExt = num.length === 4 && Number(num) >= 1000 && Number(num) <= 1100;
    if (isInternalExt && String(user.extension) === num) {
      setError('Kendi dahilinizi arayamazsınız');
      return;
    }
    setError('');
    setCallState('dialing');
    try {
      if (isInternalExt) {
        if (!sip?.enabled || !sip?.call) {
          throw new Error('WebRTC hazır değil. Dahili arama için softphone kayıtlı olmalı.');
        }
        setActiveCallId(null);
        await sip.ensureRegistered?.();
        await sip.call(num);
        setCallState('ringing');
        return;
      }
      // Dış arama: önce DB kaydı oluştur, sonra WebRTC ile doğrudan SIP INVITE gönder
      if (sip?.enabled && sip?.call) {
        const res = await api.post('/calls/initiate', {
          extension: user.extension,
          destination: num,
          webrtc_direct: true,
        });
        setActiveCallId(res?.data?.id || null);
        await sip.ensureRegistered?.();
        await sip.call('9' + num);
        setCallState('ringing');
      } else {
        // Fallback: AMI Originate (WebRTC hazır değilse)
        const res = await api.post('/calls/initiate', {
          extension: user.extension,
          destination: num,
        });
        setActiveCallId(res?.data?.id || null);
        setCallState('ringing');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Hata');
      setCallState('idle');
      setActiveCallId(null);
    }
  };

  const handleTransfer = useCallback(async () => {
    const dest = transferDest.replace(/\D/g, '');
    if (!dest) return;
    setTransferLoading(true);
    setError('');
    try {
      await api.post('/calls/transfer', { destination: dest, transfer_type: transferType });
      setTransferOpen(false);
      setTransferDest('');
      if (sip?.hangup) sip.hangup();
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Transfer başarısız');
    } finally {
      setTransferLoading(false);
    }
  }, [transferDest, transferType, sip]);

  const handleHangup = async () => {
    try {
      // SIP seviyesinde çağrıyı sonlandır (connected, calling, incoming tüm durumlar)
      if (sip?.hangup) {
        console.log('[Softphone] Kapat basıldı, sip.hangup() çağrılıyor');
        await sip.hangup();
      }
      // Backend'de çağrı kaydını güncelle
      let callIdToHangup = activeCallId;
      if (!callIdToHangup) {
        try {
          const activeRes = await api.get('/calls/me/active');
          callIdToHangup = activeRes?.data?.id || null;
        } catch {
          callIdToHangup = null;
        }
      }
      if (callIdToHangup) {
        await api.post(`/calls/${callIdToHangup}/hangup`).catch(() => {});
      }
    } catch (e) {
      console.warn('[Softphone] hangup hatası:', e?.message);
    } finally {
      setCallState('idle');
      setActiveCallId(null);
      setError('');
    }
  };

  const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const statusLabel = sipInCall
    ? `Görüşme ${formatDuration(callDuration)}`
    : sip?.enabled
    ? sip.state === 'registered'
      ? 'WebRTC Hazır'
      : sip.state === 'connecting'
      ? 'Bağlanıyor'
      : sip.state === 'incoming'
      ? 'Gelen'
      : sip.error
      ? 'Hata'
      : sip.state
    : callState === 'ringing'
    ? 'Aranıyor'
    : callState === 'dialing'
    ? 'Bağlanıyor'
    : 'Hazır';

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        p: 2,
        minWidth: 280,
        zIndex: 1300,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PhoneIcon color="primary" />
        <Typography variant="subtitle1">Softphone</Typography>
        <Chip label={user?.extension || '-'} size="small" />
        <Chip
          label={statusLabel}
          size="small"
          color={
            sipInCall || sip?.state === 'incoming'
              ? 'primary'
              : sip?.error
              ? 'error'
              : callState === 'ringing'
              ? 'warning'
              : callState === 'dialing'
              ? 'info'
              : 'success'
          }
          variant="outlined"
        />
      </Box>
      <TextField
        size="small"
        fullWidth
        placeholder="905551234567"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        sx={{ mb: 1 }}
        disabled={callState !== 'idle' || sipInCall}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<PhoneIcon />}
          onClick={handleCall}
          disabled={!number || callState !== 'idle' || sipInCall || !user?.extension}
        >
          Ara
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<CallEndIcon />}
          onClick={handleHangup}
          disabled={!sipInCall && callState === 'idle'}
        >
          Kapat
        </Button>
        {sipInCall && sip && (
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={sip.isHeld ? <PlayCircleIcon /> : <PauseCircleIcon />}
              onClick={sip.isHeld ? sip.unhold : sip.hold}
              title={sip.isHeld ? 'Bekletmeyi Kaldır' : 'Beklet'}
            >
              {sip.isHeld ? 'Devam' : 'Beklet'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={sip.isMuted ? <MicOffIcon /> : <MicIcon />}
              onClick={sip.isMuted ? sip.unmute : sip.mute}
            >
              {sip.isMuted ? 'Aç' : 'Sustur'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="secondary"
              startIcon={<SwapCallsIcon />}
              onClick={() => setTransferOpen(true)}
            >
              Transfer
            </Button>
          </>
        )}
      </Box>
      {sipInCall && sip?.sendDTMF && (
        <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, maxWidth: 140 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((t) => (
            <Button
              key={t}
              variant="outlined"
              size="small"
              sx={{ minWidth: 36, minHeight: 36, fontSize: t === '*' || t === '#' ? '1rem' : '1.1rem' }}
              onClick={() => sip.sendDTMF(t)}
            >
              {t}
            </Button>
          ))}
        </Box>
      )}
      {(error || sip?.error) && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
          {error || sip?.error}
        </Typography>
      )}
      <Dialog open={transferOpen} onClose={() => !transferLoading && setTransferOpen(false)}>
        <DialogTitle>Transfer</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <RadioGroup row value={transferType} onChange={(e) => setTransferType(e.target.value)}>
                <FormControlLabel value="blind" control={<Radio size="small" />} label="Blind (anında)" />
                <FormControlLabel value="attended" control={<Radio size="small" />} label="Attended (beklet + uyarı)" />
              </RadioGroup>
            </FormControl>
            <TextField
              fullWidth
              size="small"
              label="Dahili veya numara"
              placeholder="1002 veya 905551234567"
              value={transferDest}
              onChange={(e) => setTransferDest(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferOpen(false)} disabled={transferLoading}>
            İptal
          </Button>
          <Button variant="contained" onClick={handleTransfer} disabled={!transferDest.trim() || transferLoading}>
            Transfer Et
          </Button>
        </DialogActions>
      </Dialog>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {sip?.enabled
          ? `WebRTC ${user?.extension || '-'} | Click-to-Call`
          : `Click-to-Call (extension ${user?.extension || '-'})`}
      </Typography>
    </Paper>
  );
}
