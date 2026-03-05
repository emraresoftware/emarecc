import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  Tabs,
  Tab,
  Skeleton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import RouterIcon from '@mui/icons-material/Router';
import api from '../utils/api';

export default function AsteriskStatus() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get('/asterisk/status', { validateStatus: (s) => s === 200 || s === 503 })
      .then((r) => {
        setData(r.data);
        if (!r.data?.connected) setError(r.data?.error || 'AMI bağlantısı yok');
      })
      .catch((e) => {
        const status = e.response?.status;
        const msg = status === 404
          ? "API endpoint bulunamadı (404). Backend çalışıyor mu?"
          : e.response?.data?.error || e.message || 'Yüklenemedi';
        setError(msg);
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          <RouterIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Asterisk Durum
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={load}
          disabled={loading}
        >
          Yenile
        </Button>
      </Box>

      {loading && !data ? (
        <Paper sx={{ p: 2 }}>
          <Skeleton variant="rectangular" height={80} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={200} />
        </Paper>
      ) : error && !data?.connected ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
          <Typography variant="body2" sx={{ mt: 1 }}>
            Ayarlar &gt; Asterisk AMI bölümünden host, port, kullanıcı ve şifre yapılandırın.
          </Typography>
        </Alert>
      ) : null}

      {data?.connected && (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            AMI bağlantısı aktif.
          </Alert>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Kanalar (Channels)" />
            <Tab label="PJSIP Endpoint'ler" />
            <Tab label="Kuyruklar (Queues)" />
          </Tabs>
          <Paper sx={{ p: 2 }}>
            <Box
              component="pre"
              sx={{
                overflow: 'auto',
                maxHeight: 500,
                fontFamily: 'monospace',
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {tab === 0 && (data.channels || '(veri yok)')}
              {tab === 1 && (data.pjsip || '(veri yok)')}
              {tab === 2 && (data.queues || '(veri yok)')}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
}
