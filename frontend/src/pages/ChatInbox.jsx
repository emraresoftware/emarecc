import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Button,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';

export default function ChatInbox() {
  const { user } = useAuth();
  const socket = useSocket();
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('Sohbet (Lider)');
  const [newRoomAssignTo, setNewRoomAssignTo] = useState('');
  const [agents, setAgents] = useState([]);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const canOpenRoom = user?.role === 'admin' || user?.role === 'supervisor';
  const canClearAll = canOpenRoom;

  useEffect(() => {
    if (newRoomOpen && canOpenRoom) {
      api.get('/users', { params: { role: 'agent' } }).then((r) => setAgents(r.data || [])).catch(() => setAgents([]));
    }
  }, [newRoomOpen, canOpenRoom]);

  const load = () => {
    api.get('/chat/sessions').then((r) => setSessions(r.data)).catch(() => setSessions([]));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('CHAT_NEW_SESSION', () => load());
    socket.on('CHAT_ASSIGNED', () => load());
    socket.on('CHAT_SESSION_DELETED', (data) => {
      load();
      if (selected?.id === data?.sessionId) {
        setSelected(null);
        setMessages([]);
      }
    });
    socket.on('CHAT_MESSAGE', (msg) => {
      if (selected && msg.chat_session_id === selected.id) {
        setMessages((m) => [...m, msg]);
      }
      load();
    });
    return () => {
      socket.off('CHAT_NEW_SESSION');
      socket.off('CHAT_ASSIGNED');
      socket.off('CHAT_SESSION_DELETED');
      socket.off('CHAT_MESSAGE');
    };
  }, [socket, selected]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    setLoading(true);
    api.get(`/chat/sessions/${selected.id}/messages`).then((r) => setMessages(r.data)).finally(() => setLoading(false));
  }, [selected?.id]);

  const handleSelect = (s) => setSelected(s);

  const handleAssign = async () => {
    if (!selected) return;
    try {
      await api.post(`/chat/sessions/${selected.id}/assign`, { agent_id: user.id });
      load();
      setSelected((prev) => (prev ? { ...prev, assigned_agent_id: user.id, status: 'active' } : null));
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selected) return;
    try {
      await api.post(`/chat/sessions/${selected.id}/messages`, { content: input.trim() });
      setInput('');
      api.get(`/chat/sessions/${selected.id}/messages`).then((r) => setMessages(r.data));
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm('Bu sohbeti silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
      load();
      if (selected?.id === sessionId) {
        setSelected(null);
        setMessages([]);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Silinemedi');
    }
  };

  const handleClearAll = async () => {
    setClearAllConfirm(false);
    setClearing(true);
    try {
      await api.post('/chat/sessions/clear-all');
      load();
      setSelected(null);
      setMessages([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Temizlenemedi');
    } finally {
      setClearing(false);
    }
  };

  const handleOpenNewRoomDialog = () => {
    setNewRoomName('Sohbet (Lider)');
    setNewRoomAssignTo('');
    setNewRoomOpen(true);
  };

  const handleNewRoom = async () => {
    if (!canOpenRoom) return;
    setCreating(true);
    try {
      const body = { visitor_name: newRoomName || 'Sohbet (Lider)' };
      if (newRoomAssignTo) body.assign_to_agent_id = newRoomAssignTo;
      const { data } = await api.post('/chat/sessions', body);
      setNewRoomOpen(false);
      load();
      setSelected(data);
      setMessages([]);
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Sohbet odası açılamadı');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" gutterBottom>
          Canlı Sohbet (Inbox)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canOpenRoom && (
            <Button variant="contained" size="small" onClick={handleOpenNewRoomDialog} disabled={creating}>
              {creating ? 'Açılıyor...' : 'Yeni sohbet odası aç'}
            </Button>
          )}
          {canClearAll && sessions.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              color="error"
              onClick={() => setClearAllConfirm(true)}
              disabled={clearing}
            >
              Tümünü temizle
            </Button>
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Paper sx={{ width: 280, maxHeight: 500, overflow: 'auto' }}>
          <List dense>
            {sessions.map((s) => (
              <ListItemButton
                key={s.id}
                selected={selected?.id === s.id}
                onClick={() => handleSelect(s)}
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label="Sil"
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    sx={{ opacity: 0.7 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={s.visitor_name || 'Ziyaretçi'}
                  secondary={
                    <Chip size="small" label={s.status} color={s.status === 'waiting' ? 'warning' : 'default'} sx={{ mt: 0.5 }} />
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
        <Paper sx={{ flex: 1, p: 2, minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">{selected.visitor_name || 'Ziyaretçi'}</Typography>
                {selected.status === 'waiting' && (
                  <Button size="small" variant="contained" onClick={handleAssign}>
                    Üstlen
                  </Button>
                )}
              </Box>
              <Divider />
              <Box sx={{ flex: 1, overflow: 'auto', maxHeight: 280, mb: 2 }}>
                {loading ? (
                  <Typography color="text.secondary">Yükleniyor...</Typography>
                ) : (
                  messages.map((m) => (
                    <Box key={m.id} sx={{ textAlign: m.direction === 'outbound' ? 'right' : 'left', mb: 1 }}>
                      <Paper
                        sx={{
                          display: 'inline-block',
                          p: 1.5,
                          maxWidth: '80%',
                          bgcolor: m.direction === 'outbound' ? 'primary.light' : 'grey.200',
                        }}
                      >
                        <Typography variant="body2">{m.content}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(m.created_at).toLocaleTimeString('tr-TR')}
                        </Typography>
                      </Paper>
                    </Box>
                  ))
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Mesaj yazın..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                />
                <Button variant="contained" onClick={handleSend} disabled={!input.trim()}>
                  <SendIcon />
                </Button>
              </Box>
            </>
          ) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
              Soldan bir sohbet seçin
            </Typography>
          )}
        </Paper>
      </Box>
      <Dialog open={clearAllConfirm} onClose={() => !clearing && setClearAllConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Tüm sohbetleri temizle</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Tüm sohbet oturumları ve mesajlar silinecek. Bu işlem geri alınamaz. Emin misiniz?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearAllConfirm(false)} disabled={clearing}>Vazgeç</Button>
          <Button variant="contained" color="error" onClick={handleClearAll} disabled={clearing}>
            {clearing ? 'Temizleniyor...' : 'Tümünü temizle'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={newRoomOpen} onClose={() => !creating && setNewRoomOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Yeni sohbet odası</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            size="small"
            label="Sohbet adı"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Sohbet (Lider)"
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Bu sohbeti ata</InputLabel>
            <Select
              value={newRoomAssignTo}
              label="Bu sohbeti ata"
              onChange={(e) => setNewRoomAssignTo(e.target.value)}
            >
              <MenuItem value="">Kendim</MenuItem>
              {agents.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.username}{a.extension ? ` (${a.extension})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewRoomOpen(false)} disabled={creating}>İptal</Button>
          <Button variant="contained" onClick={handleNewRoom} disabled={creating}>
            {creating ? 'Açılıyor...' : 'Aç'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
