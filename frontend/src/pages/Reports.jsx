import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Tooltip,
  Collapse,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TranscriptionIcon from '@mui/icons-material/RecordVoiceOver';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { user } = useAuth();
  const [calls, setCalls] = useState([]);
  const [users, setUsers] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const [audioEl, setAudioEl] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [transcribingId, setTranscribingId] = useState(null);
  const [filters, setFilters] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    agent_id: '',
    status: '',
  });

  const isAgent = user?.role === 'agent';

  useEffect(() => {
    if (!isAgent) api.get('/users').then((r) => setUsers(r.data)).catch(() => {});
  }, [isAgent]);

  const load = () => {
    const params = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to + 'T23:59:59';
    if (isAgent) params.agent_id = user.id;
    else if (filters.agent_id) params.agent_id = filters.agent_id;
    if (filters.status) params.status = filters.status;
    api.get('/calls', { params }).then((r) => setCalls(r.data));
  };

  useEffect(() => {
    load();
  }, []);

  const togglePlay = async (call) => {
    if (playingId === call.id) {
      if (audioEl) audioEl.pause();
      setPlayingId(null);
      return;
    }
    if (audioEl) audioEl.pause();
    const token = localStorage.getItem('access_token');
    const base = import.meta.env.VITE_API_URL || '';
    const url = `${base}/api/v1/calls/${call.id}/recording`;
    try {
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Kayıt bulunamadı');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const audio = new Audio(objUrl);
      setAudioEl(audio);
      setPlayingId(call.id);
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(objUrl);
      };
      audio.onerror = () => {
        setPlayingId(null);
        URL.revokeObjectURL(objUrl);
      };
      await audio.play();
    } catch (e) {
      setPlayingId(null);
      alert(e.message || 'Kayıt oynatılamadı');
    }
  };

  const hasRecording = (c) => c.recording_path || c.asterisk_uniqueid;

  const requestTranscribe = async (call) => {
    setTranscribingId(call.id);
    try {
      await api.post(`/calls/${call.id}/transcribe`);
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Transkripsiyon başlatılamadı');
    } finally {
      setTranscribingId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        CDR Raporları
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          size="small"
          type="date"
          label="Başlangıç"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="date"
          label="Bitiş"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          InputLabelProps={{ shrink: true }}
        />
        {!isAgent && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Ajan</InputLabel>
            <Select
              value={filters.agent_id}
              label="Ajan"
              onChange={(e) => setFilters((f) => ({ ...f, agent_id: e.target.value }))}
            >
              <MenuItem value="">Tümü</MenuItem>
              {users.filter((u) => u.role === 'agent').map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.username} ({u.extension})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Durum</InputLabel>
          <Select
            value={filters.status}
            label="Durum"
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <MenuItem value="">Tümü</MenuItem>
            <MenuItem value="ANSWERED">Cevaplandı</MenuItem>
            <MenuItem value="NO ANSWER">Cevapsız</MenuItem>
            <MenuItem value="BUSY">Meşgul</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<SearchIcon />} onClick={load}>
          Filtrele
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => {
            const cols = ['Tarih', 'Arayan', 'Aranan', 'Ajan', 'Süre(sn)', 'Durum', 'Disposition'];
            const rows = calls.map((c) => [
              c.started_at ? new Date(c.started_at).toLocaleString('tr-TR') : '',
              c.caller_number || '',
              c.destination_number || '',
              c.agent_username || '',
              c.duration ?? '',
              c.status || '',
              c.disposition_code || '',
            ]);
            const csv = [cols.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `cdr-${filters.from}-${filters.to}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
          disabled={!calls.length}
        >
          CSV İndir
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Tarih</TableCell>
              <TableCell>Arayan</TableCell>
              <TableCell>Aranan</TableCell>
              <TableCell>Ajan</TableCell>
              <TableCell>Süre (sn)</TableCell>
              <TableCell>Durum</TableCell>
              <TableCell>Disposition</TableCell>
              <TableCell>Transkript</TableCell>
              <TableCell>Kayıt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {calls.map((c) => (
              <React.Fragment key={c.id}>
                <TableRow hover>
                  <TableCell padding="checkbox">
                    {(c.transcript || hasRecording(c)) && (
                      <IconButton
                        size="small"
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      >
                        {expandedId === c.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.started_at ? new Date(c.started_at).toLocaleString('tr-TR') : '-'}
                  </TableCell>
                  <TableCell>{c.caller_number || '-'}</TableCell>
                  <TableCell>{c.destination_number || '-'}</TableCell>
                  <TableCell>{c.agent_username || '-'}</TableCell>
                  <TableCell>{c.duration ?? '-'}</TableCell>
                  <TableCell>{c.status || '-'}</TableCell>
                  <TableCell>{c.disposition_code || '-'}</TableCell>
                  <TableCell>
                    {c.transcript ? (
                      <Chip size="small" label="Var" color="success" />
                    ) : hasRecording(c) ? (
                      <Tooltip title="Transkripsiyon işlemi birkaç dakika sürebilir">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<TranscriptionIcon />}
                          onClick={() => requestTranscribe(c)}
                          disabled={!!transcribingId}
                        >
                          {transcribingId === c.id ? 'Kuyrukta...' : 'Transkript Al'}
                        </Button>
                      </Tooltip>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {hasRecording(c) ? (
                      <Button
                        size="small"
                        color={playingId === c.id ? 'secondary' : 'primary'}
                        startIcon={playingId === c.id ? <StopIcon /> : <PlayArrowIcon />}
                        onClick={() => togglePlay(c)}
                      >
                        {playingId === c.id ? 'Durdur' : 'Dinle'}
                      </Button>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
                <TableRow sx={{ '& > td': { borderBottom: 0 } }}>
                  <TableCell colSpan={10} sx={{ py: 0, borderBottom: 0 }}>
                    <Collapse in={expandedId === c.id} unmountOnExit>
                      <Box sx={{ py: 2, px: 2, bgcolor: 'grey.50' }}>
                        {c.transcript ? (
                          <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                            {c.transcript}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Transkript yok. Kayıt varsa "Transkript Al" ile oluşturabilirsiniz.
                          </Typography>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
