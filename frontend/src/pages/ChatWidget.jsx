import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import api from '../utils/api';

export default function ChatWidget() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [polling, setPolling] = useState(null);

  const startSession = async () => {
    try {
      const { data } = await api.post('/chat/widget/start', {
        visitor_name: 'Ziyaretçi',
      });
      setSession(data);
      setMessages([]);
      if (polling) clearInterval(polling);
      const iv = setInterval(async () => {
        const { data: msgs } = await api.get(`/chat/widget/${data.id}/messages`);
        setMessages(msgs);
      }, 2000);
      setPolling(iv);
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Bağlantı hatası');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !session) return;
    try {
      await api.post(`/chat/widget/${session.id}/messages`, {
        content: input.trim(),
      });
      setInput('');
      const { data } = await api.get(`/chat/widget/${session.id}/messages`);
      setMessages(data);
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  useEffect(() => () => polling && clearInterval(polling), [polling]);

  if (!session) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Canlı Destek
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bir temsilci ile sohbet başlatın
        </Typography>
        <Button variant="contained" onClick={startSession}>
          Sohbet Başlat
        </Button>
      </Box>
    );
  }

  return (
    <Paper sx={{ maxWidth: 400, margin: 'auto', p: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        Canlı Destek — Bir temsilci yakında yanıt verecektir.
      </Typography>
      <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2, minHeight: 120 }}>
        {messages.map((m) => (
          <Box
            key={m.id}
            sx={{
              textAlign: m.direction === 'inbound' ? 'right' : 'left',
              mb: 1,
            }}
          >
            <Paper sx={{ display: 'inline-block', p: 1, bgcolor: m.direction === 'inbound' ? 'primary.light' : 'grey.200' }}>
              <Typography variant="body2">{m.content}</Typography>
            </Paper>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Mesajınız..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <Button variant="contained" onClick={sendMessage} disabled={!input.trim()}>
          <SendIcon />
        </Button>
      </Box>
    </Paper>
  );
}
