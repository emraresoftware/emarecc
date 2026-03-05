import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TerminalIcon from '@mui/icons-material/Terminal';
import RouterIcon from '@mui/icons-material/Router';
import api from '../utils/api';

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return { raw: line };
  }
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [ast, setAst] = useState(null);
  const [health, setHealth] = useState(null);
  const [tab, setTab] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [agentFilter, setAgentFilter] = useState('agent12');

  const load = () => {
    api
      .get('/debug/logs', { params: { limit: 200 } })
      .then((r) => setLogs(r.data?.logs || []))
      .catch(() => {});
    api
      .get('/debug/asterisk')
      .then((r) => setAst(r.data))
      .catch(() => setAst(null));
    api
      .get('/debug/call-health', { params: { agent: agentFilter || undefined } })
      .then((r) => setHealth(r.data || null))
      .catch(() => setHealth(null));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(load, 2000);
    return () => clearInterval(iv);
  }, [autoRefresh, agentFilter]);

  const ageSec = (startedAt) => {
    if (!startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          <TerminalIcon sx={{ mr: 1 }} />
          Canlı Loglar
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            size="small"
            label="Agent"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            placeholder="agent12 veya 1001"
          />
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                size="small"
              />
            }
            label="Otomatik yenile"
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>
            Yenile
          </Button>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Backend Logları" />
        <Tab label="Asterisk Durum (Kısa)" icon={<RouterIcon fontSize="small" />} iconPosition="start" />
        <Tab label="Çağrı Sağlığı" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Box
            component="pre"
            sx={{
              maxHeight: 500,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {logs.map((line, idx) => {
              const obj = parseLine(line);
              const ts = obj.ts || '';
              const level = obj.level || '';
              const msg = obj.msg || obj.raw || '';
              const meta = { ...obj };
              delete meta.ts;
              delete meta.level;
              delete meta.msg;
              const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
              return `${ts} [${level}] ${msg}${metaStr}\n`;
            })}
          </Box>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Asterisk Özet Komut Çıktıları
          </Typography>
          <Box
            component="pre"
            sx={{
              maxHeight: 500,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            Kanallar:
            {'\n'}
            {ast?.channels || '(veri yok)'}
            {'\n\n'}
            PJSIP ext-10xx:
            {'\n'}
            {ast?.pjsip || '(veri yok)'}
            {'\n\n'}
            Kuyruk cc-support:
            {'\n'}
            {ast?.queues || '(veri yok)'}
          </Box>
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Aktif Çağrılar (DB)
          </Typography>
          <Box
            component="pre"
            sx={{
              maxHeight: 240,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              mb: 2,
            }}
          >
            {(health?.active_calls || []).length === 0
              ? 'Aktif çağrı yok'
              : (health?.active_calls || [])
                  .map((c) => {
                    const age = ageSec(c.started_at);
                    const stale = age > 90 && (c.status === 'ringing' || c.status === 'initiating') ? ' [STALE?]' : '';
                    return `${c.started_at || '-'} | ${c.agent_username || '-'}(${c.agent_extension || '-'}) | ${c.status} | ${c.destination_number || '-'} | ${age}s${stale}`;
                  })
                  .join('\n')}
          </Box>

          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Asterisk Kanallar (Concise)
          </Typography>
          <Box
            component="pre"
            sx={{
              maxHeight: 220,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              mb: 2,
            }}
          >
            {health?.channels || '(veri yok)'}
          </Box>

          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            PJSIP Contacts
          </Typography>
          <Box
            component="pre"
            sx={{
              maxHeight: 220,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {health?.contacts || '(veri yok)'}
          </Box>
        </Paper>
      )}
    </Box>
  );
}

