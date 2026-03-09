import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { useAuth } from '../context/AuthContext';
import { useSip } from '../context/SipContext';
import api from '../utils/api';

export default function QuickDialDialog({ open, onClose }) {
  const { user } = useAuth();
  const sip = useSip();
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeCall, setActiveCall] = useState(null);
  const [hangupLoading, setHangupLoading] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    const fetchActive = () => {
      api.get('/calls/me/active')
        .then((r) => setActiveCall(r.data?.id ? r.data : null))
        .catch(() => setActiveCall(null));
    };
    fetchActive();
    const interval = setInterval(fetchActive, 3000);
    return () => clearInterval(interval);
  }, [open, user?.id]);

  const handleCall = async () => {
    const num = number.replace(/\D/g, '');
    const nlen = num.length;
    const isInternalExt = nlen === 4 && Number(num) >= 1000 && Number(num) <= 1100;
    const isExternal = nlen >= 10;
    if (!isInternalExt && !isExternal) {
      setError('Geçerli bir numara girin (4 haneli dahili veya 05551234567)');
      return;
    }
    if (!user?.extension) {
      setError('Dahili numaranız tanımlı değil');
      return;
    }
    if (isInternalExt && String(user.extension) === num) {
      setError('Kendi dahilinizi arayamazsınız');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isInternalExt) {
        if (!sip?.enabled || !sip?.call) {
          throw new Error('WebRTC hazır değil. Dahili arama için softphone kayıtlı olmalı.');
        }
        await sip.ensureRegistered?.();
        await sip.call(num);
        onClose?.();
        setNumber('');
        return;
      }
      // Dış arama: DB kaydı + doğrudan SIP INVITE
      if (sip?.enabled && sip?.call) {
        await api.post('/calls/initiate', {
          extension: user.extension,
          destination: num,
          webrtc_direct: true,
        });
        await sip.ensureRegistered?.();
        await sip.call('9' + num);
      } else {
        await api.post('/calls/initiate', {
          extension: user.extension,
          destination: num,
        });
      }
      onClose?.();
      setNumber('');
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Arama başlatılamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNumber('');
    setError('');
    onClose?.();
  };

  const handleHangup = async () => {
    if (!activeCall?.id) return;
    setHangupLoading(true);
    setError('');
    try {
      await api.post(`/calls/${activeCall.id}/hangup`);
      setActiveCall(null);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Çağrı sonlandırılamadı');
    } finally {
      setHangupLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Numara Ara</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Kayıtlı olmasa bile herhangi bir numarayı arayabilirsiniz. Örn: 05551234567 veya 905551234567
        </Typography>
        <TextField
          fullWidth
          label="Telefon numarası"
          placeholder="0555 123 45 67"
          value={number}
          onChange={(e) => {
            setNumber(e.target.value);
            setError('');
          }}
          inputProps={{ inputMode: 'tel' }}
          sx={{ mb: 2 }}
          disabled={loading}
        />
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {activeCall && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2">
              Aktif çağrı: {activeCall.destination_number || activeCall.caller_number || activeCall.id}
            </Typography>
            <Button
              color="error"
              variant="outlined"
              size="small"
              startIcon={<CallEndIcon />}
              onClick={handleHangup}
              disabled={hangupLoading}
            >
              {hangupLoading ? 'Sonlandırılıyor...' : 'Çağrıyı bitir'}
            </Button>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={handleClose}>İptal</Button>
          <Button
            variant="contained"
            startIcon={<PhoneIcon />}
            onClick={handleCall}
            disabled={!number.trim() || loading || !user?.extension}
          >
            {loading ? 'Aranıyor...' : 'Ara'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
