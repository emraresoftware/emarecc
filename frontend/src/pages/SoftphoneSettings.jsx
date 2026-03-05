import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  TextField,
} from '@mui/material';
import api from '../utils/api';

function getSipServerInfo() {
  const base = import.meta.env.VITE_API_URL || window.location.origin;
  try {
    const url = new URL(base);
    return {
      host: url.hostname,
      port: 5060,
      transport: 'UDP',
      password: 'webrtc123',
    };
  } catch {
    return {
      host: window.location.hostname || '192.168.1.56',
      port: 5060,
      transport: 'UDP',
      password: 'webrtc123',
    };
  }
}

export default function SoftphoneSettings() {
  const [agents, setAgents] = useState([]);
  const sip = getSipServerInfo();

  useEffect(() => {
    api
      .get('/users', { params: { role: 'agent' } })
      .then((r) => setAgents(r.data || []))
      .catch(() => setAgents([]));
  }, []);

  const globalSample = `Sunucu / Proxy: ${sip.host}
Port: ${sip.port}
Transport: ${sip.transport}
Kullanıcı adı: <dahili numara> (örn. 1001)
Şifre: ${sip.password}`;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Softphone Ayarları
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Ajanların IP telefon / softphone programında kullanması gereken SIP bilgileri aşağıdadır.
        Her ajan için kullanıcı adı <b>kendi dahili numarası</b>, şifre ise varsayılan olarak
        <b> {sip.password}</b> dir.
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Genel SIP Sunucu Bilgisi
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Sunucu / Proxy"
            size="small"
            value={sip.host}
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="Port"
            size="small"
            value={sip.port}
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="Transport"
            size="small"
            value={sip.transport}
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="Varsayılan Şifre"
            size="small"
            value={sip.password}
            InputProps={{ readOnly: true }}
          />
        </Box>
        <TextField
          label="Örnek Konfigürasyon"
          size="small"
          value={globalSample}
          multiline
          minRows={4}
          sx={{ mt: 2, width: '100%' }}
          InputProps={{ readOnly: true }}
        />
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ajan</TableCell>
              <TableCell>Dahili</TableCell>
              <TableCell>Durum</TableCell>
              <TableCell>Softphone Kullanıcı / Şifre</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {agents.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.extension || '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={u.status}
                    size="small"
                    color={u.status === 'ready' ? 'success' : u.status === 'paused' ? 'warning' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  {u.extension ? (
                    <Typography variant="body2">
                      Kullanıcı adı: <b>{u.extension}</b> &nbsp; Şifre: <b>{sip.password}</b>
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Bu kullanıcıya henüz dahili atanmadı.
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

