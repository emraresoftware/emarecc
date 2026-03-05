import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import api from '../utils/api';

export default function CustomerImportDialog({ open, onClose, onSuccess, canAssignToAgent }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [agents, setAgents] = useState([]);
  const [assignToAgentId, setAssignToAgentId] = useState('');
  useEffect(() => {
    if (open && canAssignToAgent) {
      api.get('/users', { params: { role: 'agent' } })
        .then((r) => setAgents(r.data || []))
        .catch(() => setAgents([]));
    } else if (!open) {
      setAssignToAgentId('');
    }
  }, [open, canAssignToAgent]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (
      f &&
      (
        f.name.toLowerCase().endsWith('.csv') ||
        f.type === 'text/csv' ||
        f.name.toLowerCase().endsWith('.xlsx') ||
        f.name.toLowerCase().endsWith('.xls') ||
        f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        f.type === 'application/vnd.ms-excel'
      )
    ) {
      setFile(f);
      setResult(null);
    } else {
      setFile(null);
      alert('Sadece CSV veya Excel (.xlsx) dosyası seçin');
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (canAssignToAgent && assignToAgentId) {
        form.append('assign_to_agent_id', assignToAgentId);
      }
      const res = await api.post('/customers/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      onSuccess?.();
    } catch (e) {
      setResult({ error: e.response?.data?.message || 'İçe aktarım başarısız' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setAssignToAgentId('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>İçe Aktar (CSV / Excel)</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          CSV formatı: telefon, ad, soyad, not, borc, son_odeme, dosya_no (ilk satır başlık olmalı).<br />
          Excel için: Borçlu GSM raporu (örn. \"515 - Borçlu GSM Raporu lead.xlsx\") gibi tablolar da desteklenir.
        </Typography>
        {canAssignToAgent && (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Atanacak ajan</InputLabel>
            <Select
              value={assignToAgentId}
              label="Atanacak ajan"
              onChange={(e) => setAssignToAgentId(e.target.value)}
            >
              <MenuItem value="">— Seçin —</MenuItem>
              {agents.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.username}{a.extension ? ` (${a.extension})` : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Button variant="outlined" component="label">
          Dosya Seç
          <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={handleFile} />
        </Button>
        {file && <Typography variant="body2" sx={{ mt: 1 }}>{file.name}</Typography>}
        {loading && <LinearProgress sx={{ mt: 2 }} />}
        {result && !result.error && (
          <Typography color="success.main" sx={{ mt: 2 }}>
            {result.inserted} müşteri eklendi, {result.skipped} atlandı
          </Typography>
        )}
        {result?.error && (
          <Typography color="error" sx={{ mt: 2 }}>{result.error}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Kapat</Button>
        <Button variant="contained" onClick={handleImport} disabled={!file || loading}>
          {loading ? 'Aktarılıyor...' : 'İçe Aktar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
