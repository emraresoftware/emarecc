import { useEffect, useState, useRef, useCallback } from 'react';
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
  Chip,
  IconButton,
  Tooltip,
  Divider,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TerminalIcon from '@mui/icons-material/Terminal';
import RouterIcon from '@mui/icons-material/Router';
import SearchIcon from '@mui/icons-material/Search';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import api from '../utils/api';

/* ─── Renk paleti ─── */
const levelColors = {
  error: { bg: '#fdecea', text: '#d32f2f', border: '#f44336' },
  warn: { bg: '#fff8e1', text: '#f57c00', border: '#ffa726' },
  warning: { bg: '#fff8e1', text: '#f57c00', border: '#ffa726' },
  info: { bg: '#e3f2fd', text: '#1565c0', border: '#42a5f5' },
  debug: { bg: '#f3e5f5', text: '#7b1fa2', border: '#ab47bc' },
  verbose: { bg: '#e8f5e9', text: '#2e7d32', border: '#66bb6a' },
  notice: { bg: '#e0f7fa', text: '#00838f', border: '#26c6da' },
  dtmf: { bg: '#fce4ec', text: '#c62828', border: '#ef5350' },
};

function getLevelStyle(level) {
  const l = (level || '').toLowerCase();
  return levelColors[l] || { bg: '#f5f5f5', text: '#616161', border: '#bdbdbd' };
}

/* ─── Tarih formatlama ─── */
function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function formatTimestampMs(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const base = d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${base}.${ms}`;
  } catch {
    return ts;
  }
}

/* ─── Log satırını parse et ─── */
function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return { raw: line };
  }
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [astLogs, setAstLogs] = useState([]);
  const [ast, setAst] = useState(null);
  const [health, setHealth] = useState(null);
  const [tab, setTab] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [agentFilter, setAgentFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  // Asterisk log filtreleri
  const [astSearchText, setAstSearchText] = useState('');
  const [astLevelFilter, setAstLevelFilter] = useState('all');
  const [astLogFile, setAstLogFile] = useState('full');
  const logEndRef = useRef(null);
  const astLogEndRef = useRef(null);

  const load = useCallback(() => {
    api
      .get('/debug/logs', { params: { limit: 500 } })
      .then((r) => setLogs(r.data?.logs || []))
      .catch(() => {});
    api
      .get('/debug/asterisk')
      .then((r) => setAst(r.data))
      .catch(() => setAst(null));
    api
      .get('/debug/asterisk-logs', { params: { limit: 500, file: astLogFile, filter: astSearchText || undefined } })
      .then((r) => setAstLogs(r.data?.logs || []))
      .catch(() => setAstLogs([]));
    api
      .get('/debug/call-health', { params: { agent: agentFilter || undefined } })
      .then((r) => setHealth(r.data || null))
      .catch(() => setHealth(null));
  }, [agentFilter, astLogFile, astSearchText]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(load, 2000);
    return () => clearInterval(iv);
  }, [autoRefresh, load]);

  // Otomatik scroll
  useEffect(() => {
    if (autoScroll && logEndRef.current && tab === 0) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (autoScroll && astLogEndRef.current && tab === 1) {
      astLogEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, astLogs, autoScroll, tab]);

  const ageSec = (startedAt) => {
    if (!startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  };

  /* ─── Logları filtrele ─── */
  const filteredLogs = logs
    .map((line) => parseLine(line))
    .filter((obj) => {
      if (levelFilter !== 'all' && (obj.level || '').toLowerCase() !== levelFilter) return false;
      if (searchText) {
        const text = JSON.stringify(obj).toLowerCase();
        if (!text.includes(searchText.toLowerCase())) return false;
      }
      return true;
    });

  const logCounts = logs.reduce((acc, line) => {
    const obj = parseLine(line);
    const l = (obj.level || 'other').toLowerCase();
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});

  return (
    <Box>
      {/* ─── Başlık ─── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TerminalIcon />
          Canlı Loglar
          <Chip label={`${filteredLogs.length} / ${logs.length}`} size="small" variant="outlined" />
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} size="small" />}
            label="Oto yenile"
            sx={{ mr: 0 }}
          />
          <FormControlLabel
            control={<Switch checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} size="small" />}
            label="Oto kaydır"
            sx={{ mr: 0 }}
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} size="small">
            Yenile
          </Button>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Backend Logları" />
        <Tab label="Asterisk Logları" icon={<RouterIcon fontSize="small" />} iconPosition="start" />
        <Tab label="Çağrı Sağlığı" />
      </Tabs>

      {/* ═══════════ TAB 0: Backend Logları ═══════════ */}
      {tab === 0 && (
        <Paper sx={{ p: 0, overflow: 'hidden' }}>
          {/* Filtre çubuğu */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1.5,
              bgcolor: '#fafafa',
              borderBottom: '1px solid #e0e0e0',
              flexWrap: 'wrap',
            }}
          >
            <TextField
              size="small"
              placeholder="Ara..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Seviye</InputLabel>
              <Select value={levelFilter} label="Seviye" onChange={(e) => setLevelFilter(e.target.value)}>
                <MenuItem value="all">Tümü</MenuItem>
                <MenuItem value="error">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#d32f2f' }} /> Error
                  </Box>
                </MenuItem>
                <MenuItem value="warn">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f57c00' }} /> Warn
                  </Box>
                </MenuItem>
                <MenuItem value="info">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1565c0' }} /> Info
                  </Box>
                </MenuItem>
                <MenuItem value="debug">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#7b1fa2' }} /> Debug
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {/* Seviye sayaçları */}
            <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
              {Object.entries(logCounts).map(([level, count]) => {
                const style = getLevelStyle(level);
                return (
                  <Chip
                    key={level}
                    label={`${level}: ${count}`}
                    size="small"
                    sx={{ bgcolor: style.bg, color: style.text, fontWeight: 600, fontSize: 11 }}
                    onClick={() => setLevelFilter(levelFilter === level ? 'all' : level)}
                  />
                );
              })}
            </Box>
          </Box>

          {/* Log listesi */}
          <Box
            sx={{
              maxHeight: 600,
              overflow: 'auto',
              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
              fontSize: 12,
            }}
          >
            {filteredLogs.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">Log bulunamadı</Typography>
              </Box>
            ) : (
              filteredLogs.map((obj, idx) => {
                const style = getLevelStyle(obj.level);
                const meta = { ...obj };
                delete meta.ts;
                delete meta.level;
                delete meta.msg;
                delete meta.raw;
                const hasExtra = Object.keys(meta).length > 0;

                return (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 0,
                      px: 1.5,
                      py: 0.5,
                      borderBottom: '1px solid #f0f0f0',
                      bgcolor: idx % 2 === 0 ? '#fff' : '#fafafa',
                      '&:hover': { bgcolor: style.bg + '66' },
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {/* Satır no */}
                    <Typography
                      sx={{
                        minWidth: 36,
                        color: '#bdbdbd',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        lineHeight: '22px',
                        textAlign: 'right',
                        pr: 1,
                        userSelect: 'none',
                      }}
                    >
                      {idx + 1}
                    </Typography>

                    {/* Tarih damgası */}
                    <Typography
                      sx={{
                        minWidth: 175,
                        maxWidth: 175,
                        color: '#78909c',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        lineHeight: '22px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {formatTimestampMs(obj.ts)}
                    </Typography>

                    {/* Seviye badge */}
                    <Box
                      sx={{
                        minWidth: 52,
                        maxWidth: 52,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Chip
                        label={(obj.level || '?').toUpperCase()}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: style.bg,
                          color: style.text,
                          borderLeft: `3px solid ${style.border}`,
                          borderRadius: '3px',
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    </Box>

                    {/* Mesaj + meta */}
                    <Box sx={{ flex: 1, minWidth: 0, lineHeight: '22px' }}>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: '#212121',
                          wordBreak: 'break-word',
                        }}
                      >
                        {obj.msg || obj.raw || '(boş)'}
                      </Typography>
                      {hasExtra && (
                        <Typography
                          component="span"
                          sx={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: '#90a4ae',
                            ml: 1,
                            wordBreak: 'break-word',
                          }}
                        >
                          {JSON.stringify(meta)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })
            )}
            <div ref={logEndRef} />
          </Box>

          {/* Alt bar */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 0.5,
              bgcolor: '#fafafa',
              borderTop: '1px solid #e0e0e0',
              fontSize: 11,
              color: 'text.secondary',
            }}
          >
            <span>
              {filteredLogs.length} satır gösteriliyor
              {searchText && ` (filtre: "${searchText}")`}
              {levelFilter !== 'all' && ` (seviye: ${levelFilter})`}
            </span>
            <Tooltip title="En alta kaydır">
              <IconButton
                size="small"
                onClick={() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      )}

      {/* ═══════════ TAB 1: Asterisk Logları ═══════════ */}
      {/* ═══════════ TAB 1: Asterisk Logları ═══════════ */}
      {tab === 1 && (() => {
        const filteredAst = astLogs.filter((obj) => {
          if (astLevelFilter !== 'all' && (obj.level || '').toLowerCase() !== astLevelFilter) return false;
          return true;
        });
        const astCounts = astLogs.reduce((acc, obj) => {
          const l = (obj.level || 'other').toLowerCase();
          acc[l] = (acc[l] || 0) + 1;
          return acc;
        }, {});

        return (
          <Paper sx={{ p: 0, overflow: 'hidden' }}>
            {/* Filtre çubuğu */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1.5,
                bgcolor: '#fafafa',
                borderBottom: '1px solid #e0e0e0',
                flexWrap: 'wrap',
              }}
            >
              <TextField
                size="small"
                placeholder="Ara (INVITE, 1000, error...)"
                value={astSearchText}
                onChange={(e) => setAstSearchText(e.target.value)}
                sx={{ minWidth: 220 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Seviye</InputLabel>
                <Select value={astLevelFilter} label="Seviye" onChange={(e) => setAstLevelFilter(e.target.value)}>
                  <MenuItem value="all">Tümü</MenuItem>
                  {['ERROR', 'WARNING', 'NOTICE', 'VERBOSE', 'DEBUG', 'DTMF'].map((lv) => {
                    const style = getLevelStyle(lv);
                    return (
                      <MenuItem key={lv} value={lv.toLowerCase()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: style.text }} /> {lv}
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Dosya</InputLabel>
                <Select value={astLogFile} label="Dosya" onChange={(e) => setAstLogFile(e.target.value)}>
                  <MenuItem value="full">full (detaylı)</MenuItem>
                  <MenuItem value="messages">messages (kısa)</MenuItem>
                </Select>
              </FormControl>

              {/* Seviye sayaçları */}
              <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                {Object.entries(astCounts).map(([level, count]) => {
                  const style = getLevelStyle(level);
                  return (
                    <Chip
                      key={level}
                      label={`${level}: ${count}`}
                      size="small"
                      sx={{ bgcolor: style.bg, color: style.text, fontWeight: 600, fontSize: 11 }}
                      onClick={() => setAstLevelFilter(astLevelFilter === level ? 'all' : level)}
                    />
                  );
                })}
              </Box>
            </Box>

            {/* Log listesi */}
            <Box
              sx={{
                maxHeight: 600,
                overflow: 'auto',
                fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                fontSize: 12,
              }}
            >
              {filteredAst.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">Asterisk logu bulunamadı</Typography>
                </Box>
              ) : (
                filteredAst.map((obj, idx) => {
                  const style = getLevelStyle(obj.level);
                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0,
                        px: 1.5,
                        py: 0.4,
                        borderBottom: '1px solid #f0f0f0',
                        bgcolor: idx % 2 === 0 ? '#fff' : '#fafafa',
                        '&:hover': { bgcolor: style.bg + '66' },
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {/* Satır no */}
                      <Typography
                        sx={{
                          minWidth: 36,
                          color: '#bdbdbd',
                          fontSize: 11,
                          fontFamily: 'monospace',
                          lineHeight: '20px',
                          textAlign: 'right',
                          pr: 1,
                          userSelect: 'none',
                        }}
                      >
                        {idx + 1}
                      </Typography>

                      {/* Tarih */}
                      <Typography
                        sx={{
                          minWidth: 140,
                          maxWidth: 140,
                          color: '#78909c',
                          fontSize: 11,
                          fontFamily: 'monospace',
                          lineHeight: '20px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {obj.ts || '—'}
                      </Typography>

                      {/* Seviye */}
                      <Box
                        sx={{
                          minWidth: 68,
                          maxWidth: 68,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Chip
                          label={(obj.level || '?').toUpperCase()}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: 9,
                            fontWeight: 700,
                            bgcolor: style.bg,
                            color: style.text,
                            borderLeft: `3px solid ${style.border}`,
                            borderRadius: '3px',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      </Box>

                      {/* Modül */}
                      <Typography
                        sx={{
                          minWidth: 130,
                          maxWidth: 130,
                          color: '#546e7a',
                          fontSize: 11,
                          fontFamily: 'monospace',
                          lineHeight: '20px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flexShrink: 0,
                        }}
                      >
                        {obj.module || ''}
                      </Typography>

                      {/* Mesaj */}
                      <Box sx={{ flex: 1, minWidth: 0, lineHeight: '20px' }}>
                        <Typography
                          component="span"
                          sx={{
                            fontSize: 12,
                            fontFamily: 'monospace',
                            color: '#212121',
                            wordBreak: 'break-word',
                          }}
                        >
                          {obj.msg || ''}
                        </Typography>
                        {obj.callId && (
                          <Typography
                            component="span"
                            sx={{
                              fontSize: 10,
                              fontFamily: 'monospace',
                              color: '#b0bec5',
                              ml: 1,
                            }}
                          >
                            [{obj.callId}]
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })
              )}
              <div ref={astLogEndRef} />
            </Box>

            {/* Alt bar */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 0.5,
                bgcolor: '#fafafa',
                borderTop: '1px solid #e0e0e0',
                fontSize: 11,
                color: 'text.secondary',
              }}
            >
              <span>
                {filteredAst.length} satır gösteriliyor ({astLogFile})
                {astSearchText && ` (filtre: "${astSearchText}")`}
                {astLevelFilter !== 'all' && ` (seviye: ${astLevelFilter})`}
              </span>
              <Tooltip title="En alta kaydır">
                <IconButton
                  size="small"
                  onClick={() => astLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>
        );
      })()}

      {/* ═══════════ TAB 2: Çağrı Sağlığı ═══════════ */}
      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <TextField
              size="small"
              label="Agent filtre"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              placeholder="agent12 veya 1001"
              sx={{ minWidth: 180 }}
            />
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} size="small">
              Yenile
            </Button>
            {health?.now && (
              <Typography variant="caption" color="text.secondary">
                Sunucu zamanı: {formatTimestamp(health.now)}
              </Typography>
            )}
          </Box>

          {/* Aktif çağrılar tablosu */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            Aktif Çağrılar (DB)
          </Typography>
          <Box sx={{ overflow: 'auto', mb: 3 }}>
            {(health?.active_calls || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Aktif çağrı yok
              </Typography>
            ) : (
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  '& th, & td': {
                    px: 1.5,
                    py: 0.75,
                    borderBottom: '1px solid #e0e0e0',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  },
                  '& th': {
                    bgcolor: '#f5f5f5',
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    color: '#616161',
                  },
                  '& tr:hover td': { bgcolor: '#e3f2fd' },
                }}
              >
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Agent</th>
                    <th>Dahili</th>
                    <th>Durum</th>
                    <th>Hedef</th>
                    <th>Süre</th>
                  </tr>
                </thead>
                <tbody>
                  {(health?.active_calls || []).map((c, i) => {
                    const age = ageSec(c.started_at);
                    const stale = age > 90 && (c.status === 'ringing' || c.status === 'initiating');
                    return (
                      <tr key={i}>
                        <td>{formatTimestamp(c.started_at)}</td>
                        <td>{c.agent_username || '—'}</td>
                        <td>{c.agent_extension || '—'}</td>
                        <td>
                          <Chip
                            label={c.status}
                            size="small"
                            color={
                              c.status === 'connected'
                                ? 'success'
                                : c.status === 'ringing'
                                ? 'warning'
                                : 'default'
                            }
                            sx={{ height: 20, fontSize: 11 }}
                          />
                          {stale && (
                            <Chip label="STALE" size="small" color="error" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />
                          )}
                        </td>
                        <td>{c.destination_number || '—'}</td>
                        <td>{age}s</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Asterisk Kanallar */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            Asterisk Kanallar
          </Typography>
          <Box
            component="pre"
            sx={{
              maxHeight: 200,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              bgcolor: '#263238',
              color: '#e0e0e0',
              p: 1.5,
              borderRadius: 1,
              m: 0,
              mb: 2,
            }}
          >
            {health?.channels || '(veri yok)'}
          </Box>

          {/* PJSIP Contacts */}
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            PJSIP Contacts
          </Typography>
          <Box
            component="pre"
            sx={{
              maxHeight: 200,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              bgcolor: '#263238',
              color: '#e0e0e0',
              p: 1.5,
              borderRadius: 1,
              m: 0,
            }}
          >
            {health?.contacts || '(veri yok)'}
          </Box>
        </Paper>
      )}
    </Box>
  );
}

