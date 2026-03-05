import { useState, useEffect, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import { useSocket } from '../context/SocketContext';

const baseUrl = import.meta.env.VITE_API_URL || '';

export default function WallboardPublic() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const socket = useSocket();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const fetchStats = useMemo(
    () => () => {
      if (!token) return setError('Token gerekli');
      fetch(`${baseUrl}/api/v1/stats/wallboard?token=${encodeURIComponent(token)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Yetkisiz'))))
        .then(setStats)
        .catch(() => setError('Bağlantı hatası'));
    },
    [token]
  );

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => clearInterval(id);
  }, [fetchStats]);

  useEffect(() => {
    if (socket) socket.on('STATS_UPDATE', setStats);
    return () => socket?.off('STATS_UPDATE');
  }, [socket]);

  if (!token) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a1929', color: 'white' }}>
        <Typography>URL: /wallboard/public?token=YOUR_TOKEN</Typography>
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a1929', color: '#f44336' }}>
        <Typography variant="h6">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: 4,
        bgcolor: '#0a1929',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Typography variant="h4" sx={{ mb: 4, textAlign: 'center', fontWeight: 700 }}>
        Canlı İzleme — TV Modu
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        <Box sx={{ bgcolor: 'rgba(76,175,80,0.2)', borderRadius: 2, p: 4, minWidth: 200, textAlign: 'center' }}>
          <PeopleIcon sx={{ fontSize: 48, color: '#81c784', mb: 1 }} />
          <Typography color="#81c784">Hazır</Typography>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>{stats?.agents?.ready ?? '-'}</Typography>
        </Box>
        <Box sx={{ bgcolor: 'rgba(255,152,0,0.2)', borderRadius: 2, p: 4, minWidth: 200, textAlign: 'center' }}>
          <PhoneInTalkIcon sx={{ fontSize: 48, color: '#ffb74d', mb: 1 }} />
          <Typography color="#ffb74d">Meşgul</Typography>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>{stats?.agents?.busy ?? '-'}</Typography>
        </Box>
        <Box sx={{ bgcolor: 'rgba(233,30,99,0.2)', borderRadius: 2, p: 4, minWidth: 200, textAlign: 'center' }}>
          <ScheduleIcon sx={{ fontSize: 48, color: '#f48fb1', mb: 1 }} />
          <Typography color="#f48fb1">Duraklatılmış</Typography>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>{stats?.agents?.paused ?? '-'}</Typography>
        </Box>
        <Box sx={{ bgcolor: 'rgba(33,150,243,0.2)', borderRadius: 2, p: 4, minWidth: 200, textAlign: 'center' }}>
          <Typography color="#64b5f6">Kuyrukta</Typography>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>{stats?.queue_waiting ?? '-'}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
