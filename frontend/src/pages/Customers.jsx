import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PhoneIcon from '@mui/icons-material/Phone';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import CampaignIcon from '@mui/icons-material/Campaign';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CustomerForm from '../components/CustomerForm';
import CustomerImportDialog from '../components/CustomerImportDialog';
import CustomerExportDialog from '../components/CustomerExportDialog';
import LeadAssignDialog from '../components/LeadAssignDialog';
import QuickDialDialog from '../components/QuickDialDialog';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [leadAssignOpen, setLeadAssignOpen] = useState(false);
  const [quickDialOpen, setQuickDialOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agentFilter, setAgentFilter] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const canImport = user?.role === 'admin' || user?.role === 'supervisor';
  const canAssignLeads = user?.role === 'admin' || user?.role === 'supervisor';
  const canBulkDelete = user?.role === 'admin';
  const canFilterByAgent = canAssignLeads;

  useEffect(() => {
    if (canFilterByAgent) {
      api.get('/users', { params: { role: 'agent' } })
        .then((r) => setAgents(r.data || []))
        .catch(() => setAgents([]));
    }
  }, [canFilterByAgent]);

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.post('/customers/bulk-delete', { ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setDeleteOpen(false);
      load();
    } catch (e) {
      setDeleteError(e.response?.data?.message || 'Toplu silme başarısız');
    } finally {
      setDeleteLoading(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    const params = { ...(search ? { search } : {}) };
    if (canFilterByAgent && agentFilter) params.owner_id = agentFilter;
    api.get('/customers', { params })
      .then((r) => setCustomers(r.data))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, [search, canFilterByAgent, agentFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Müşteriler
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Ara (ad, telefon)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 250 }}
        />
        {canFilterByAgent && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Ajana göre filtre</InputLabel>
            <Select
              value={agentFilter}
              label="Ajana göre filtre"
              onChange={(e) => setAgentFilter(e.target.value)}
            >
              <MenuItem value="">Tümü</MenuItem>
              <MenuItem value="__none__">Atanmamış</MenuItem>
              {agents.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.username}{a.extension ? ` (${a.extension})` : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
          Yeni Müşteri
        </Button>
        {user?.extension && (
          <Button variant="outlined" startIcon={<PhoneIcon />} onClick={() => setQuickDialOpen(true)}>
            Numara Ara
          </Button>
        )}
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => setExportOpen(true)}>
          Dışa Aktar
        </Button>
        {canImport && (
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setImportOpen(true)}>
            İçe Aktar
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {canAssignLeads && (
          <Button
            variant="outlined"
            startIcon={<CampaignIcon />}
            onClick={() => setLeadAssignOpen(true)}
            disabled={selectedIds.size === 0}
          >
            Kampanyaya Ekle ({selectedIds.size})
          </Button>
        )}
        {canBulkDelete && (
          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteOpen(true)}
            disabled={selectedIds.size === 0}
          >
            Toplu Sil ({selectedIds.size})
          </Button>
        )}
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedIds.size > 0 && selectedIds.size < customers.length}
                  checked={customers.length > 0 && selectedIds.size === customers.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(customers.map((c) => c.id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </TableCell>
              <TableCell>Ad Soyad</TableCell>
              <TableCell>Telefon</TableCell>
              <TableCell>Borç</TableCell>
              <TableCell>Dosya No</TableCell>
              {canFilterByAgent && <TableCell>Atanan ajan</TableCell>}
              <TableCell align="right">İşlem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((c) => (
              <TableRow
                key={c.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/customers/${c.id}`)}
                selected={selectedIds.has(c.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      setSelectedIds(next);
                    }}
                  />
                </TableCell>
                <TableCell>{[c.first_name, c.last_name].filter(Boolean).join(' ') || '-'}</TableCell>
                <TableCell>{c.phone_number}</TableCell>
                <TableCell>{c.debt_amount ? `${c.debt_amount} TL` : '-'}</TableCell>
                <TableCell>{c.file_number || '-'}</TableCell>
                {canFilterByAgent && (
                  <TableCell>
                    {c.owner_username ? `${c.owner_username}${c.owner_extension ? ` (${c.owner_extension})` : ''}` : '—'}
                  </TableCell>
                )}
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => navigate(`/customers/${c.id}`)}>
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}
      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
      <CustomerExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <CustomerImportDialog open={importOpen} onClose={() => setImportOpen(false)} onSuccess={load} canAssignToAgent={canAssignLeads} />
      <LeadAssignDialog
        open={leadAssignOpen}
        onClose={() => setLeadAssignOpen(false)}
        customerIds={selectedIds}
        onSuccess={() => { setLeadAssignOpen(false); setSelectedIds(new Set()); }}
      />
      <QuickDialDialog open={quickDialOpen} onClose={() => setQuickDialOpen(false)} />
      <Dialog open={deleteOpen} onClose={() => !deleteLoading && setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Toplu Sil</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {selectedIds.size} müşteriyi silmek üzeresiniz. Bu işlem geri alınamaz.
          </Typography>
          {deleteError && (
            <Typography variant="body2" color="error">
              {deleteError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
            Vazgeç
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBulkDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Siliniyor...' : 'Sil'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
