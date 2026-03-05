import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import api from '../utils/api';

export default function LeadAssignDialog({ open, onClose, customerIds, onSuccess }) {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      api.get('/campaigns').then((r) => setCampaigns(r.data)).catch(() => {});
      setCampaignId('');
      setResult(null);
    }
  }, [open]);

  const handleAssign = async () => {
    if (!campaignId || !customerIds?.length) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post(`/campaigns/${campaignId}/leads/bulk`, {
        customer_ids: Array.from(customerIds),
      });
      setResult(res.data);
      onSuccess?.();
    } catch (e) {
      setResult({ error: e.response?.data?.message || 'Lead aktarımı başarısız' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Kampanyaya Lead Ekle</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {customerIds?.size || 0} müşteri seçildi — kampanyaya lead olarak eklenecek.
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Kampanya</InputLabel>
          <Select
            value={campaignId}
            label="Kampanya"
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <MenuItem value=""><em>Seçiniz</em></MenuItem>
            {campaigns.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name} ({c.type})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {result && !result.error && (
          <Typography color="success.main" sx={{ mt: 2 }}>
            {result.added} lead eklendi
          </Typography>
        )}
        {result?.error && (
          <Typography color="error" sx={{ mt: 2 }}>{result.error}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>İptal</Button>
        <Button variant="contained" onClick={handleAssign} disabled={!campaignId || loading}>
          {loading ? 'Ekleniyor...' : 'Ekle'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
