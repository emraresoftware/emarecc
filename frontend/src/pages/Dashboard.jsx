import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Grid, Button } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [notifStatus, setNotifStatus] = useState(null);

  useEffect(() => {
    api.get('/stats/realtime').then((r) => setStats(r.data)).catch(() => setStats({ agents: { ready: 0, paused: 0 } }));
  }, []);

  const requestNotificationPermission = () => {
    if (!('Notification' in window)) {
      setNotifStatus('desteklenmiyor');
      return;
    }
    Notification.requestPermission().then((p) => {
      setNotifStatus(p === 'granted' ? 'açık' : p === 'denied' ? 'kapalı' : p);
    });
  };

  const testScreenPop = () => {
    api.post('/test/screen-pop', {
      callerId: '+905551234567',
      extension: user?.extension || '1001',
    }).then(() => {}).catch((e) => alert(e.response?.data?.message || e.message));
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Hoş geldin, {user?.username}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Dahili: {user?.extension || '-'} | Rol: {user?.role}
      </Typography>
      {user?.role === 'agent' && user?.extension && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={testScreenPop}>
            Test Screen Pop
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<NotificationsIcon />}
            onClick={requestNotificationPermission}
          >
            {notifStatus === 'açık'
              ? 'Bildirimler açık ✓'
              : notifStatus === 'kapalı'
              ? 'Reddedildi'
              : typeof Notification !== 'undefined' && Notification.permission === 'granted'
              ? 'Bildirimler açık'
              : 'Bildirim izni ver'}
          </Button>
        </Box>
      )}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Aktif Ajanlar (Ready)</Typography>
              <Typography variant="h4">{stats?.agents?.ready ?? '-'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Duraklatılmış</Typography>
              <Typography variant="h4">{stats?.agents?.paused ?? '-'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Kuyrukta Bekleyen</Typography>
              <Typography variant="h4">{stats?.queue_waiting ?? '-'}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
