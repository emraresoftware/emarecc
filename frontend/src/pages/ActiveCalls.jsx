import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import HearingIcon from '@mui/icons-material/Hearing';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import GroupIcon from '@mui/icons-material/Group';
import RefreshIcon from '@mui/icons-material/Refresh';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import api from '../utils/api';

const statusLabels = {
  ringing: 'Çalıyor',
  connected: 'Aktif',
  initiating: 'Başlatılıyor',
  ANSWERED: 'Cevaplandı',
  'NO ANSWER': 'Cevapsız',
  failed: 'Başarısız',
};

export default function ActiveCalls() {
  const [calls, setCalls] = useState([]);
  const [recentCalls, setRecentCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const [transferCallId, setTransferCallId] = useState(null);
  const [transferDest, setTransferDest] = useState('');
  const [transferType, setTransferType] = useState('blind');
  const [transferLoading, setTransferLoading] = useState(false);

  const load = () => {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    Promise.all([
      api.get('/calls/active').catch(() => ({ data: [] })),
      api.get('/calls', { params: { from: since } }).catch(() => ({ data: [] })),
    ])
      .then(([activeRes, allRes]) => {
        setCalls(Array.isArray(activeRes.data) ? activeRes.data : []);
        const recent = Array.isArray(allRes.data)
          ? allRes.data
              .filter((c) => ['initiating', 'ringing', 'connected', 'ANSWERED', 'NO ANSWER', 'failed'].includes(c.status))
              .slice(0, 50)
          : [];
        setRecentCalls(recent);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, []);

  const handleTransfer = async () => {
    if (!transferCallId || !transferDest.trim()) return;
    setTransferLoading(true);
    try {
      await api.post(`/calls/${transferCallId}/transfer`, { destination: transferDest.trim(), transfer_type: transferType });
      setTransferCallId(null);
      setTransferDest('');
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Transfer başarısız');
    } finally {
      setTransferLoading(false);
    }
  };

  const chanSpy = async (callId, mode) => {
    setPending(callId);
    try {
      await api.post(`/calls/${callId}/${mode}`);
      load();
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'İşlem başarısız';
      alert(msg);
    } finally {
      setPending(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Aktif Çağrılar (Süpervizör)</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Yenile
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Aktif görüşmelere gizli dinleme (Spy), fısıldama (Whisper) veya araya girme (Barge) yapabilirsiniz.
        Dahili numaranızın ayarlı olması gerekir — aramanız açılacaktır.
      </Typography>
      {loading && !calls.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : !calls.length ? (
        <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          Şu an aktif çağrı yok
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ajan</TableCell>
                <TableCell>Arayan / Aranan</TableCell>
                <TableCell>Durum</TableCell>
                <TableCell>Başlangıç</TableCell>
                <TableCell align="right">Müdahale</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calls.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.agent_username || '-'} ({c.agent_extension || '-'})
                  </TableCell>
                  <TableCell>
                    {c.direction === 'inbound'
                      ? c.caller_number || '-'
                      : c.destination_number || '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={statusLabels[c.status] || c.status}
                      color={c.status === 'connected' ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {c.started_at
                      ? new Date(c.started_at).toLocaleString('tr-TR')
                      : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Gizli dinleme (ajan fark etmez)">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<HearingIcon />}
                          onClick={() => chanSpy(c.id, 'spy')}
                          disabled={!!pending}
                          sx={{ mr: 0.5 }}
                        >
                          Spy
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Fısıldama (sadece ajan duyar)">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<RecordVoiceOverIcon />}
                          onClick={() => chanSpy(c.id, 'whisper')}
                          disabled={!!pending}
                          sx={{ mr: 0.5 }}
                        >
                          Whisper
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Araya girme (3'lü konferans)">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={<GroupIcon />}
                          onClick={() => chanSpy(c.id, 'barge')}
                          disabled={!!pending}
                          sx={{ mr: 0.5 }}
                        >
                          Barge
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Blind transfer">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SwapCallsIcon />}
                          onClick={() => setTransferCallId(c.id)}
                          disabled={!!pending}
                        >
                          Transfer
                        </Button>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Son Denemeler (30 dk)
        </Typography>
        {!recentCalls.length ? (
          <Paper sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            Son 30 dakikada çağrı denemesi yok
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ajan</TableCell>
                  <TableCell>Arayan / Aranan</TableCell>
                  <TableCell>Durum</TableCell>
                  <TableCell>Başlangıç</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentCalls.map((c) => (
                  <TableRow key={`recent-${c.id}`}>
                    <TableCell>
                      {c.agent_username || '-'} ({c.agent_extension || '-'})
                    </TableCell>
                    <TableCell>
                      {c.direction === 'inbound'
                        ? c.caller_number || '-'
                        : c.destination_number || '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={statusLabels[c.status] || c.status}
                        color={c.status === 'connected' ? 'success' : c.status === 'ringing' || c.status === 'initiating' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {c.started_at
                        ? new Date(c.started_at).toLocaleString('tr-TR')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={!!transferCallId} onClose={() => !transferLoading && setTransferCallId(null)}>
        <DialogTitle>Transfer</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset" sx={{ mb: 2, display: 'block' }}>
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
            sx={{ mt: 1, minWidth: 280 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferCallId(null)} disabled={transferLoading}>İptal</Button>
          <Button variant="contained" onClick={handleTransfer} disabled={!transferDest.trim() || transferLoading}>
            Transfer Et
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
