import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import Chip from '@mui/material/Chip';
import api from '../utils/api';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [queues, setQueues] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'preview', queue_id: '', script_id: '' });
  const [leadCustomer, setLeadCustomer] = useState('');

  const load = () => api.get('/campaigns').then((r) => setCampaigns(r.data));

  useEffect(() => {
    load();
    api.get('/scripts').then((r) => setScripts(r.data)).catch(() => {});
    api.get('/queues').then((r) => setQueues(r.data || [])).catch(() => setQueues([]));
  }, []);

  const openCreate = () => {
    setForm({ name: '', type: 'preview', queue_id: '', script_id: '' });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    try {
      await api.post('/campaigns', { ...form, queue_id: form.queue_id || null, script_id: form.script_id || null });
      setFormOpen(false);
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const openAddLead = (c) => {
    setLeadOpen(c);
    api.get('/customers').then((r) => setCustomers(r.data)).catch(() => setCustomers([]));
    setLeadCustomer('');
  };

  const handleAddLead = async () => {
    if (!leadOpen || !leadCustomer) return;
    try {
      const cust = customers.find((x) => x.id === leadCustomer);
      await api.post(`/campaigns/${leadOpen.id}/leads`, {
        customer_id: leadCustomer,
        phone_number: cust?.phone_number,
      });
      setLeadOpen(null);
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Kampanyalar</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Yeni Kampanya
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ad</TableCell>
              <TableCell>Tip</TableCell>
              <TableCell>Kuyruk</TableCell>
              <TableCell>Durum</TableCell>
              <TableCell>Script</TableCell>
              <TableCell width={120} align="right">İşlem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.type}</TableCell>
                <TableCell>{c.queue_name || '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.status || 'draft'} color={c.status === 'active' ? 'success' : 'default'} />
                  {c.type === 'power' && c.queue_id && (
                    <>
                      {c.status !== 'active' && (
                        <IconButton size="small" onClick={() => api.patch(`/campaigns/${c.id}`, { status: 'active' }).then(load)} title="Başlat">
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      )}
                      {c.status === 'active' && (
                        <IconButton size="small" onClick={() => api.patch(`/campaigns/${c.id}`, { status: 'paused' }).then(load)} title="Duraklat">
                          <PauseIcon fontSize="small" />
                        </IconButton>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell>{c.script_name || '-'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openAddLead(c)} title="Borçlu ekle">
                    <PersonAddIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Kampanya</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField required label="Ad" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <FormControl>
              <InputLabel>Tip</InputLabel>
              <Select value={form.type} label="Tip" onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <MenuItem value="preview">Preview (manuel)</MenuItem>
                <MenuItem value="power">Power (otomatik arama)</MenuItem>
              </Select>
            </FormControl>
            {form.type === 'power' && (
              <FormControl>
                <InputLabel>Kuyruk (zorunlu)</InputLabel>
                <Select value={form.queue_id} label="Kuyruk (zorunlu)" onChange={(e) => setForm((f) => ({ ...f, queue_id: e.target.value }))}>
                  <MenuItem value="">Seçiniz</MenuItem>
                  {queues.map((q) => (
                    <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <FormControl>
              <InputLabel>Script</InputLabel>
              <Select value={form.script_id} label="Script" onChange={(e) => setForm((f) => ({ ...f, script_id: e.target.value }))}>
                <MenuItem value="">Yok</MenuItem>
                {scripts.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleSave}>Oluştur</Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={!!leadOpen} onClose={() => setLeadOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Borçlu Ekle</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Müşteri</InputLabel>
            <Select value={leadCustomer} label="Müşteri" onChange={(e) => setLeadCustomer(e.target.value)}>
              <MenuItem value="">Seçiniz</MenuItem>
              {customers.filter((c) => c.debt_amount > 0).map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ')} - {c.phone_number} ({c.debt_amount} TL)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleAddLead} sx={{ mt: 2 }} disabled={!leadCustomer}>
            Ekle
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
