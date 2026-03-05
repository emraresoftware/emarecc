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
  IconButton,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';

const ROLES = { admin: 'Admin', supervisor: 'Lider', agent: 'Ajan' };

export default function LiveSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  const fetchSessions = () => {
    setLoading(true);
    api
      .get('/sessions')
      .then((r) => setSessions(r.data?.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('SESSION_UPDATE', (data) => {
      if (Array.isArray(data?.sessions)) setSessions(data.sessions);
    });
    return () => socket.off('SESSION_UPDATE');
  }, [socket]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon /> Canlı Oturumlar
        </Typography>
        <IconButton onClick={fetchSessions} disabled={loading} title="Yenile">
          <RefreshIcon />
        </IconButton>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Şu an uygulamaya giriş yapmış kullanıcılar. Giriş/çıkış anlık güncellenir.
      </Typography>
      <Paper>
        {loading && sessions.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Durum</TableCell>
                <TableCell>Kullanıcı</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Dahili</TableCell>
                <TableCell>Giriş (UTC)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    Şu an kayıtlı oturum yok.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((s) => (
                  <TableRow key={s.userId}>
                    <TableCell>
                      <Chip
                        label="Çevrimiçi"
                        size="small"
                        color="success"
                        sx={{ minWidth: 88 }}
                      />
                    </TableCell>
                    <TableCell>{s.username}</TableCell>
                    <TableCell>{ROLES[s.role] || s.role}</TableCell>
                    <TableCell>{s.extension || '–'}</TableCell>
                    <TableCell>
                      {s.connectedAt
                        ? new Date(s.connectedAt).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '–'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
