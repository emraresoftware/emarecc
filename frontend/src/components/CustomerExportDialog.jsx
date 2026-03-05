import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import api from '../utils/api';

export default function CustomerExportDialog({ open, onClose }) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = search ? { search } : {};
      const res = await api.get('/customers/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'musteriler.csv';
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      alert(e.response?.data?.message || 'Dışa aktarım başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Dışa Aktar (CSV)</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          size="small"
          label="Filtre (opsiyonel)"
          placeholder="Ad, soyad veya telefon"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>İptal</Button>
        <Button variant="contained" onClick={handleExport} disabled={loading}>
          {loading ? 'İndiriliyor...' : 'İndir'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
