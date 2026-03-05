import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function PreviewDialer() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [lead, setLead] = useState(null);
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    api.get('/campaigns').then((r) => setCampaigns(r.data)).catch(() => {});
  }, []);

  const loadNext = () => {
    if (!campaignId) return;
    setLoading(true);
    setLead(null);
    setScript('');
    api.get(`/campaigns/${campaignId}/next-lead`)
      .then((r) => {
        setLead(r.data.lead);
        setScript(r.data.script || '');
      })
      .catch(() => setLead(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (campaignId) loadNext();
    else { setLead(null); setScript(''); }
  }, [campaignId]);

  const handleCall = async () => {
    if (!lead || !user?.extension) return;
    setCalling(true);
    try {
      await api.post('/calls/initiate', {
        extension: user.extension,
        destination: lead.phone_number,
        customer_id: lead.customer_id,
      });
      if (lead.id) {
        await api.patch(`/campaigns/${campaignId}/leads/${lead.id}/status`, { status: 'ringing' });
      }
      setLead(null);
      setScript('');
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Arama başlatılamadı');
    }
    setCalling(false);
  };

  const handleSkip = () => loadNext();

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Preview Dialer (Tahsilat)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Sıradaki borçluyu görüntüleyip Ara ile arama başlatın
      </Typography>

      <FormControl size="small" sx={{ minWidth: 220, mb: 2 }}>
        <InputLabel>Kampanya</InputLabel>
        <Select
          value={campaignId}
          label="Kampanya"
          onChange={(e) => setCampaignId(e.target.value)}
        >
          <MenuItem value="">Seçiniz</MenuItem>
          {campaigns.filter((c) => c.type === 'preview').map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {loading && <CircularProgress size={24} sx={{ ml: 2 }} />}

      {!loading && campaignId && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {lead ? (
            <>
              <Card sx={{ minWidth: 300 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Sıradaki Borçlu</Typography>
                  <Typography variant="h6">
                    {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '-'}
                  </Typography>
                  <Typography>Telefon: {lead.phone_number}</Typography>
                  {lead.debt_amount && <Typography>Borç: {lead.debt_amount} TL</Typography>}
                  {lead.file_number && <Typography>Dosya: {lead.file_number}</Typography>}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      startIcon={<PhoneIcon />}
                      onClick={handleCall}
                      disabled={!user?.extension || calling}
                    >
                      {calling ? 'Aranıyor...' : 'Ara'}
                    </Button>
                    <Button variant="outlined" onClick={handleSkip}>
                      Atlat
                    </Button>
                  </Box>
                </CardContent>
              </Card>
              {script && (
                <Paper sx={{ p: 2, flex: 1, minWidth: 280, maxWidth: 400 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Okunacak metin</Typography>
                  <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                    {script}
                  </Typography>
                </Paper>
              )}
            </>
          ) : (
            <Card sx={{ minWidth: 300 }}>
              <CardContent>
                <Typography color="text.secondary">Sırada bekleyen borçlu yok</Typography>
                <Button startIcon={<RefreshIcon />} onClick={loadNext} sx={{ mt: 1 }}>
                  Yenile
                </Button>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {campaignId && campaigns.filter((c) => c.id === campaignId).length === 0 && (
        <Typography color="text.secondary">Önce bir kampanya oluşturup borçlu ekleyin (Admin)</Typography>
      )}
    </Box>
  );
}
