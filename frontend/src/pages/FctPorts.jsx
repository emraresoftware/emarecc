import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Tooltip,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SimCardIcon from '@mui/icons-material/SimCard';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import RouterIcon from '@mui/icons-material/Router';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || '';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// Sinyal gücünü bar olarak göster (0-31 arası, 31=max)
function SignalBar({ value }) {
  const level = Math.min(Math.max(parseInt(value) || 0, 0), 31);
  const percent = Math.round((level / 31) * 100);
  let color = 'error';
  if (percent > 60) color = 'success';
  else if (percent > 30) color = 'warning';

  return (
    <Tooltip title={`Sinyal: ${level}/31 (${percent}%)`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <SignalCellularAltIcon
          fontSize="small"
          color={level === 0 ? 'disabled' : color}
        />
        <LinearProgress
          variant="determinate"
          value={percent}
          color={color}
          sx={{ width: 50, height: 6, borderRadius: 3 }}
        />
        <Typography variant="caption" color="text.secondary">
          {level}
        </Typography>
      </Box>
    </Tooltip>
  );
}

// Hat durumunu renkli chip olarak göster
function StateChip({ state }) {
  if (!state) return <Chip label="Bilinmiyor" size="small" color="default" />;
  const s = state.toUpperCase();
  if (s.startsWith('CONNECTED'))
    return (
      <Chip
        icon={<PhoneInTalkIcon />}
        label={state}
        size="small"
        color="success"
        variant="filled"
      />
    );
  if (s.startsWith('DIALING') || s.startsWith('ALERTING'))
    return <Chip label={state} size="small" color="warning" variant="filled" />;
  if (s === 'IDLE')
    return <Chip label="Boşta" size="small" color="info" variant="outlined" />;
  return <Chip label={state} size="small" />;
}

export default function FctPorts() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [ports, setPorts] = useState([]);
  const [device, setDevice] = useState(null);
  const [goipOnline, setGoipOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [editPort, setEditPort] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restartingLine, setRestartingLine] = useState(null);

  const fetchPorts = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/v1/fct/ports`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Port bilgileri alınamadı');
      const data = await res.json();
      setPorts(data.ports || []);
      setGoipOnline(data.goipOnline);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchDevice = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/fct/device`, { headers: getAuthHeaders() });
      if (res.ok) setDevice(await res.json());
    } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/users`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchPorts();
    fetchDevice();
    fetchUsers();

    // Otomatik yenileme — 15 saniyede bir
    const interval = setInterval(() => fetchPorts(true), 15000);
    return () => clearInterval(interval);
  }, [fetchPorts, fetchDevice, fetchUsers]);

  const handleEdit = (port) => {
    setEditPort({ ...port });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editPort) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/fct/ports/${editPort.port_number}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          label: editPort.label,
          sim_number: editPort.sim_number,
          operator: editPort.operator,
          assigned_extension: editPort.assigned_extension || null,
          assigned_user_id: editPort.assigned_user_id || null,
          priority: editPort.priority,
          enabled: editPort.enabled,
          notes: editPort.notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Kayıt başarısız');
      }
      setEditOpen(false);
      fetchPorts(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async (portNumber) => {
    if (!window.confirm(`Port ${portNumber} GSM modülü yeniden başlatılsın mı?`)) return;
    setRestartingLine(portNumber);
    try {
      const res = await fetch(`${API}/api/v1/fct/ports/${portNumber}/restart`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Restart başarısız');
      // 5 saniye sonra yenile
      setTimeout(() => {
        fetchPorts(true);
        setRestartingLine(null);
      }, 5000);
    } catch {
      setRestartingLine(null);
    }
  };

  const activePorts = ports.filter(
    (p) => p.live?.gsm_sim === 'Y' && p.live?.gsm_status === 'Y'
  ).length;
  const busyPorts = ports.filter(
    (p) => p.live?.line_state && !['IDLE', ''].includes(p.live.line_state)
  ).length;

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>FCT portları yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RouterIcon /> FCT Gateway Yönetimi
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            icon={goipOnline ? <CheckCircleIcon /> : <CancelIcon />}
            label={goipOnline ? 'GoIP16 Çevrimiçi' : 'GoIP16 Çevrimdışı'}
            color={goipOnline ? 'success' : 'error'}
            variant="filled"
          />
          <Button
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => fetchPorts(true)}
            disabled={refreshing}
            variant="outlined"
            size="small"
          >
            Yenile
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Özet Kartları */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="h4" color="primary">
                {activePorts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktif SIM
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="h4" color="success.main">
                {busyPorts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Görüşmede
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="h4" color="info.main">
                {ports.filter((p) => p.enabled).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Etkin Port
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="h4" color="text.secondary">
                16
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Toplam Port
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Cihaz Bilgileri */}
      {device && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Cihaz Bilgileri
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Typography variant="body2">
              <strong>Model:</strong> {device.model}
            </Typography>
            <Typography variant="body2">
              <strong>Firmware:</strong> {device.firmware}
            </Typography>
            <Typography variant="body2">
              <strong>Seri No:</strong> {device.serial}
            </Typography>
            <Typography variant="body2">
              <strong>MAC:</strong> {device.mac}
            </Typography>
            <Typography variant="body2">
              <strong>Asterisk IP:</strong> {device.ip}
            </Typography>
            <Typography variant="body2">
              <strong>Cihaz Saati:</strong> {device.time}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Port Tablosu */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 'bold', bgcolor: 'grey.100' } }}>
              <TableCell width={50}>Port</TableCell>
              <TableCell width={60}>SIM</TableCell>
              <TableCell width={60}>GSM</TableCell>
              <TableCell>Operatör</TableCell>
              <TableCell width={130}>Sinyal</TableCell>
              <TableCell>Hat Durumu</TableCell>
              <TableCell>Atanan Dahili</TableCell>
              <TableCell>Atanan Kullanıcı</TableCell>
              <TableCell width={60}>Etkin</TableCell>
              <TableCell>Toplam Arama</TableCell>
              <TableCell>Not</TableCell>
              {isAdmin && <TableCell width={100} align="center">İşlem</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {ports.map((port) => {
              const live = port.live;
              const hasSim = live?.gsm_sim === 'Y';
              const gsmOk = live?.gsm_status === 'Y';
              const isRestarting = restartingLine === port.port_number;

              return (
                <TableRow
                  key={port.port_number}
                  sx={{
                    opacity: port.enabled ? 1 : 0.5,
                    bgcolor: live?.line_state?.startsWith('CONNECTED')
                      ? 'success.50'
                      : live?.line_state?.startsWith('DIALING') || live?.line_state?.startsWith('ALERTING')
                        ? 'warning.50'
                        : 'inherit',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {port.port_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {goipOnline ? (
                      <Tooltip title={hasSim ? 'SIM takılı' : 'SIM yok'}>
                        <SimCardIcon
                          fontSize="small"
                          color={hasSim ? 'success' : 'disabled'}
                        />
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {goipOnline ? (
                      <Chip
                        size="small"
                        label={gsmOk ? 'OK' : 'Yok'}
                        color={gsmOk ? 'success' : 'default'}
                        variant={gsmOk ? 'filled' : 'outlined'}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {live?.operator || port.operator || '—'}
                  </TableCell>
                  <TableCell>
                    {goipOnline && hasSim ? (
                      <SignalBar value={live?.gsm_signal} />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {isRestarting ? (
                      <Chip
                        icon={<CircularProgress size={12} />}
                        label="Yeniden başlatılıyor..."
                        size="small"
                        color="warning"
                      />
                    ) : (
                      <StateChip state={live?.line_state} />
                    )}
                  </TableCell>
                  <TableCell>
                    {port.assigned_extension ? (
                      <Chip label={port.assigned_extension} size="small" color="primary" variant="outlined" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Atanmamış
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {port.assigned_username ? (
                      <Typography variant="body2">
                        {port.assigned_username}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {port.enabled ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : (
                      <CancelIcon fontSize="small" color="disabled" />
                    )}
                  </TableCell>
                  <TableCell>
                    {live?.call_count ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ maxWidth: 120, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={port.notes}
                    >
                      {port.notes || '—'}
                    </Typography>
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="center">
                      <Tooltip title="Düzenle">
                        <IconButton size="small" onClick={() => handleEdit(port)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {hasSim && (
                        <Tooltip title="GSM Restart">
                          <IconButton
                            size="small"
                            onClick={() => handleRestart(port.port_number)}
                            disabled={isRestarting}
                            color="warning"
                          >
                            <RestartAltIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Port Düzenleme Dialogu */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Port {editPort?.port_number} Ayarları
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Etiket"
              value={editPort?.label || ''}
              onChange={(e) => setEditPort({ ...editPort, label: e.target.value })}
              size="small"
              fullWidth
              placeholder="Ör: Vodafone Hat 1"
            />
            <TextField
              label="SIM Numarası"
              value={editPort?.sim_number || ''}
              onChange={(e) => setEditPort({ ...editPort, sim_number: e.target.value })}
              size="small"
              fullWidth
              placeholder="05XX XXX XXXX"
            />
            <TextField
              label="Operatör"
              value={editPort?.operator || ''}
              onChange={(e) => setEditPort({ ...editPort, operator: e.target.value })}
              size="small"
              fullWidth
              placeholder="Vodafone, Turkcell, Türk Telekom"
            />
            <TextField
              label="Atanan Dahili"
              value={editPort?.assigned_extension || ''}
              onChange={(e) => setEditPort({ ...editPort, assigned_extension: e.target.value })}
              size="small"
              fullWidth
              placeholder="1001"
              helperText="Bu porta özel dahili atayın. Boş bırakırsanız port genel havuzda kalır."
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Atanan Kullanıcı</InputLabel>
              <Select
                value={editPort?.assigned_user_id || ''}
                onChange={(e) => setEditPort({ ...editPort, assigned_user_id: e.target.value })}
                label="Atanan Kullanıcı"
              >
                <MenuItem value="">
                  <em>Atanmamış</em>
                </MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.username} — Dahili: {u.extension || 'yok'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Öncelik"
              type="number"
              value={editPort?.priority ?? 0}
              onChange={(e) => setEditPort({ ...editPort, priority: parseInt(e.target.value) || 0 })}
              size="small"
              fullWidth
              helperText="Yüksek öncelikli portlar önce kullanılır"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editPort?.enabled || false}
                  onChange={(e) => setEditPort({ ...editPort, enabled: e.target.checked })}
                />
              }
              label="Port Etkin"
            />
            <TextField
              label="Notlar"
              value={editPort?.notes || ''}
              onChange={(e) => setEditPort({ ...editPort, notes: e.target.value })}
              size="small"
              fullWidth
              multiline
              rows={2}
              placeholder="Ek bilgi..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>İptal</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
