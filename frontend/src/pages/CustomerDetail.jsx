import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSip } from '../context/SipContext';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  IconButton,
  Grid,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhoneIcon from '@mui/icons-material/Phone';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import api from '../utils/api';
import CustomerForm from '../components/CustomerForm';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const sip = useSip();
  const [customer, setCustomer] = useState(null);
  const [note, setNote] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [calling, setCalling] = useState(false);
  const [playingRecording, setPlayingRecording] = useState(null);
  const playingAudioRef = useRef(null);

  useEffect(() => {
    api.get(`/customers/${id}`).then((r) => setCustomer(r.data)).catch(() => navigate('/customers'));
  }, [id, navigate]);

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await api.post(`/customers/${id}/notes`, { content: note });
      setNote('');
      const r = await api.get(`/customers/${id}`);
      setCustomer(r.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditSaved = () => {
    api.get(`/customers/${id}`).then((r) => setCustomer(r.data));
    setEditOpen(false);
  };

  const handleCall = async () => {
    if (!user?.extension || !customer?.phone_number) return;
    setCalling(true);
    try {
      const num = customer.phone_number.replace(/\D/g, '');
      if (sip?.enabled && sip?.call) {
        await api.post('/calls/initiate', {
          extension: user.extension,
          destination: customer.phone_number,
          customer_id: customer.id,
          webrtc_direct: true,
        });
        await sip.ensureRegistered?.();
        await sip.call('9' + num);
      } else {
        await api.post('/calls/initiate', {
          extension: user.extension,
          destination: customer.phone_number,
          customer_id: customer.id,
        });
      }
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Arama başlatılamadı');
    }
    setCalling(false);
  };

  if (!customer) return null;

  const notes = (customer.notes_list || []).map((n) => ({
    id: `note-${n.id}`,
    type: 'note',
    date: new Date(n.created_at),
    content: n.content,
  }));
  const calls = (customer.call_history || []).map((c) => ({
    id: `call-${c.id}`,
    callId: c.id,
    type: 'call',
    date: new Date(c.started_at),
    duration: c.duration,
    status: c.status,
    direction: c.direction,
    hasRecording: !!(c.recording_path || c.asterisk_uniqueid),
  }));
  const chats = (customer.interactions || []).map((i) => ({
    id: `chat-${i.id}`,
    type: 'chat',
    date: new Date(i.created_at),
    content: i.content,
    direction: i.direction,
    agent_username: i.agent_username,
  }));
  const timeline = [...notes, ...calls, ...chats]
    .sort((a, b) => b.date - a.date)
    .slice(0, 50);

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/customers')} sx={{ mb: 2 }}>
        Geri
      </Button>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          {[customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Müşteri'}
        </Typography>
        <Box>
          <Button
            startIcon={<PhoneIcon />}
            variant="outlined"
            sx={{ mr: 1 }}
            onClick={handleCall}
            disabled={!user?.extension || calling}
          >
            {calling ? 'Aranıyor...' : 'Ara'}
          </Button>
          <IconButton onClick={() => setEditOpen(true)}>
            <EditIcon />
          </IconButton>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Müşteri detayları</Typography>
        <Grid container spacing={2}>
          {[
            { key: 'takip_id', label: 'Takip ID' },
            { key: 'dosya_transfer_tarihi', label: 'Dosya Transfer Tarihi', date: true },
            { key: 'buro_adi', label: 'Büro Adı' },
            { key: 'first_name', label: 'Adı' },
            { key: 'last_name', label: 'Soyadı' },
            { key: 'dosya_asamasi', label: 'Dosya Aşaması' },
            { key: 'icrada_acilis_tarihi', label: 'İcrada Açılış Tarihi', date: true },
            { key: 'kapanis_tipi', label: 'Kapanış Tipi' },
            { key: 'kapanis_tarihi', label: 'Kapanış Tarihi', date: true },
            { key: 'bildirim_tarihi', label: 'Bildirim Tarihi', date: true },
            { key: 'icra_dairesi', label: 'İcra Dairesi' },
            { key: 'icra_no', label: 'İcra No' },
            { key: 'tckn', label: 'TCKN' },
            { key: 'phone_number', label: 'Borçlu GSM' },
            { key: 'fatura_id', label: 'Fatura ID' },
            { key: 'musteri_no', label: 'Müşteri No' },
            { key: 'debt_amount', label: 'Borç (TL)', format: (v) => v != null ? `${v} TL` : '' },
            { key: 'file_number', label: 'Dosya No' },
            { key: 'last_payment_date', label: 'Son Ödeme Tarihi', date: true },
            { key: 'notes', label: 'Not' },
          ].map(({ key, label, date, format }) => {
            const v = customer[key];
            const display = v == null || v === ''
              ? '—'
              : (format ? format(v) : (date ? new Date(v).toLocaleDateString('tr-TR') : String(v)));
            return (
              <Grid item xs={12} sm={6} md={4} key={key}>
                <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                <Typography variant="body2">{display}</Typography>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Yeni Not</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Not ekle..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button variant="contained" onClick={addNote}>Ekle</Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Etkileşim Geçmişi</Typography>
        <List dense>
          {timeline.map((item) => (
            <ListItem key={item.id} sx={{ alignItems: 'flex-start', gap: 1.5 }}>
              <Box sx={{ color: 'text.secondary', mt: 0.25 }}>
                {item.type === 'call' && <PhoneIcon fontSize="small" />}
                {item.type === 'note' && <StickyNote2OutlinedIcon fontSize="small" />}
                {item.type === 'chat' && <ChatOutlinedIcon fontSize="small" />}
              </Box>
              <ListItemText
                primary={
                  item.type === 'call'
                    ? `Çağrı — ${item.duration}s, ${item.status}${item.direction ? ` (${item.direction})` : ''}`
                    : item.type === 'note'
                    ? item.content
                    : `Sohbet ${item.direction === 'in' ? '(Gelen)' : '(Giden)'}: ${item.content || '(mesaj)'}${item.agent_username ? ` — ${item.agent_username}` : ''}`
                }
                secondary={item.date.toLocaleString('tr-TR')}
              />
              {item.type === 'call' && item.hasRecording && (
                <ListItemSecondaryAction>
                  <IconButton
                    size="small"
                    onClick={async () => {
                      if (playingRecording === item.callId) {
                        playingAudioRef.current?.pause();
                        playingAudioRef.current = null;
                        setPlayingRecording(null);
                        return;
                      }
                      try {
                        const { data } = await api.get(`/calls/${item.callId}/recording`, {
                          responseType: 'blob',
                        });
                        const blob = data;
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio(url);
                        playingAudioRef.current = audio;
                        setPlayingRecording(item.callId);
                        audio.onended = () => {
                          URL.revokeObjectURL(url);
                          playingAudioRef.current = null;
                          setPlayingRecording(null);
                        };
                        audio.onerror = () => {
                          URL.revokeObjectURL(url);
                          playingAudioRef.current = null;
                          setPlayingRecording(null);
                        };
                        audio.play();
                      } catch (e) {
                        alert(e.message || 'Kayıt yüklenemedi');
                      }
                    }}
                    title={playingRecording === item.callId ? 'Durdur' : 'Kaydı dinle'}
                    color={playingRecording === item.callId ? 'primary' : 'default'}
                  >
                    <PlayArrowIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
          {timeline.length === 0 && (
            <ListItem><ListItemText primary="Henüz etkileşim yok" /></ListItem>
          )}
        </List>
      </Paper>

      <CustomerForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={handleEditSaved}
        editMode
        initialData={customer}
      />
    </Box>
  );
}
