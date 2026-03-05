import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';

export default function Wallboard() {
  const socket = useSocket();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = () => api.get('/stats/realtime').then((r) => setStats(r.data)).catch(() => setStats({ agents: { ready: 0, busy: 0, paused: 0 }, queue_waiting: 0, avg_wait_time: 0 }));
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('STATS_UPDATE', setStats);
    return () => socket.off('STATS_UPDATE');
  }, [socket]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Canlı İzleme (Wallboard)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gerçek zamanlı güncelleme (WebSocket)
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#e8f5e9' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PeopleIcon color="success" />
                <Typography color="text.secondary">Hazır (Ready)</Typography>
              </Box>
              <Typography variant="h3">{stats?.agents?.ready ?? '-'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#fff3e0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PhoneInTalkIcon color="warning" />
                <Typography color="text.secondary">Meşgul (Busy)</Typography>
              </Box>
              <Typography variant="h3">{stats?.agents?.busy ?? '-'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#fce4ec' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ScheduleIcon color="secondary" />
                <Typography color="text.secondary">Duraklatılmış</Typography>
              </Box>
              <Typography variant="h3">{stats?.agents?.paused ?? '-'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Kuyrukta Bekleyen</Typography>
              <Typography variant="h4">{stats?.queue_waiting ?? '-'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Ort. Bekleme Süresi (sn)</Typography>
              <Typography variant="h4">{stats?.avg_wait_time ?? '-'}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
