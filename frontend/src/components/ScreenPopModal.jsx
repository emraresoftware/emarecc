import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Divider,
  Grid,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import SaveIcon from '@mui/icons-material/Save';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const DISPOSITIONS = [
  { value: 'payment_promise', label: 'Ödeme sözü' },
  { value: 'refused', label: 'Reddedildi' },
  { value: 'unreachable', label: 'Ulaşılamadı' },
  { value: 'busy', label: 'Meşgul' },
  { value: 'wrong_number', label: 'Yanlış numara' },
];

export default function ScreenPopModal({ open, onClose, data }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(data?.customer || null);
  const [callHistory, setCallHistory] = useState([]);
  const [callerId, setCallerId] = useState(data?.callerId || '');
  const [callId, setCallId] = useState(data?.call_id || null);
  const [disposition, setDisposition] = useState('');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    notes: '',
    file_number: '',
    debt_amount: '',
    last_payment_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [scriptText, setScriptText] = useState('');

  const fillPlaceholders = (content, c) => {
    if (!content) return '';
    return String(content)
      .replace(/\{\{first_name\}\}/g, c?.first_name || '')
      .replace(/\{\{last_name\}\}/g, c?.last_name || '')
      .replace(/\{\{debt_amount\}\}/g, c?.debt_amount ?? '')
      .replace(/\{\{file_number\}\}/g, c?.file_number || '')
      .replace(/\{\{last_payment_date\}\}/g, c?.last_payment_date || '');
  };

  const [callbackUrl, setCallbackUrl] = useState('');
  useEffect(() => {
    if (data) {
      setCustomer(data.customer);
      setCallerId(data.callerId || '');
      setCallId(data.call_id || null);
      setCallbackUrl(data.callback_url || '');
      setDisposition('');
      if (!data.customer) {
        setForm((f) => ({ ...f, phone_number: data.callerId || '' }));
      }
      setCallHistory([]);
    }
  }, [data]);

  useEffect(() => {
    if (customer?.id) {
      api.get(`/customers/${customer.id}`).then((r) => setCallHistory(r.data?.call_history || [])).catch(() => {});
    }
  }, [customer?.id]);

  useEffect(() => {
    if (customer?.debt_amount) {
      api.get('/scripts/default').then((r) => {
        if (r.data?.content) setScriptText(fillPlaceholders(r.data.content, customer));
        else setScriptText('');
      }).catch(() => setScriptText(''));
    } else {
      setScriptText('');
    }
  }, [customer?.id, customer?.debt_amount, customer?.first_name, customer?.last_name, customer?.file_number, customer?.last_payment_date]);

  const buildNewCustomerPayload = () => {
    return {
      phone_number: form.phone_number || callerId,
      first_name: form.first_name || undefined,
      last_name: form.last_name || undefined,
      notes: form.notes || undefined,
      file_number: form.file_number || undefined,
      debt_amount: form.debt_amount ? parseFloat(String(form.debt_amount).replace(',', '.')) : undefined,
      last_payment_date: form.last_payment_date || undefined,
    };
  };

  const handleSaveNew = async () => {
    setSaving(true);
    try {
      const payload = buildNewCustomerPayload();
      const res = await api.post('/customers', payload);
      setCustomer(res.data);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleSaveAndOpenDetail = async () => {
    setSaving(true);
    try {
      const payload = buildNewCustomerPayload();
      const res = await api.post('/customers', payload);
      const created = res.data;
      setCustomer(created);
      navigate(`/customers/${created.id}`);
      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: 'error.main',
            animation: 'pulse 1.2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
              '50%': { opacity: 0.6, transform: 'scale(1.2)' },
            },
          }}
        />
        {customer ? (
          `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Müşteri'
        ) : (
          'Bilinmeyen Arayan'
        )}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Arayan: {callerId}
        </Typography>
        {callbackUrl && (
          <Button
            startIcon={<OpenInNewIcon />}
            size="small"
            href={callbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mt: 1 }}
          >
            CRM'de Aç
          </Button>
        )}
        {customer ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Müşteri detayları
            </Typography>
            <Grid container spacing={2}>
              {[
                { key: 'takip_id', label: 'Takip ID' },
                { key: 'dosya_transfer_tarihi', label: 'Dosya Transfer Tarihi', date: true },
                { key: 'buro_adi', label: 'Büro Adı' },
                { key: 'first_name', label: 'Adı' },
                { key: 'last_name', label: 'Soyadı' },
                { key: 'dosya_asamasi', label: 'Dosya Aşaması' },
                { key: 'icrada_acilis_tarihi', label: 'İcrada Açılış Tarihi', date: true },
                { key: 'kapanis_tipi', label: 'Kapanış Tipi' },
                { key: 'kapanis_tarihi', label: 'Kapanış Tarihi', date: true },
                { key: 'bildirim_tarihi', label: 'Bildirim Tarihi', date: true },
                { key: 'icra_dairesi', label: 'İcra Dairesi' },
                { key: 'icra_no', label: 'İcra No' },
                { key: 'tckn', label: 'TCKN' },
                { key: 'phone_number', label: 'Borçlu GSM' },
                { key: 'fatura_id', label: 'Fatura ID' },
                { key: 'musteri_no', label: 'Müşteri No' },
                { key: 'debt_amount', label: 'Borç (TL)', format: (v) => v != null ? `${v} TL` : '—' },
                { key: 'file_number', label: 'Dosya No' },
                { key: 'last_payment_date', label: 'Son Ödeme Tarihi', date: true },
                { key: 'notes', label: 'Not' },
              ].map(({ key, label, date, format }) => {
                const v = customer[key];
                const display =
                  v == null || v === ''
                    ? '—'
                    : (format
                      ? format(v)
                      : (date ? new Date(v).toLocaleDateString('tr-TR') : String(v)));
                return (
                  <Grid item xs={12} sm={6} key={key}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {label}
                    </Typography>
                    <Typography variant="body2">{display}</Typography>
                  </Grid>
                );
              })}
            </Grid>
            {scriptText && (
              <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Okunacak metin (Tahsilat)</Typography>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {scriptText}
                </Typography>
              </Box>
            )}
            {callHistory.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Son Aramalar</Typography>
                <List dense disablePadding>
                  {callHistory.slice(0, 5).map((c) => (
                    <ListItem key={c.id} disablePadding>
                      <ListItemText
                        primary={`${c.duration || 0}s - ${c.status || '-'}`}
                        secondary={new Date(c.started_at).toLocaleString('tr-TR')}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button
                startIcon={<PhoneIcon />}
                variant="outlined"
                onClick={onClose}
              >
                Ara
              </Button>
              {customer?.id && (
                <Button
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  onClick={() => {
                    navigate(`/customers/${customer.id}`);
                    onClose();
                  }}
                >
                  Müşteri detayı
                </Button>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Yeni müşteri olarak kaydet
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Telefon"
              value={form.phone_number}
              onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              sx={{ mb: 1 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Ad"
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              sx={{ mb: 1 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Soyad"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              sx={{ mb: 1 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Dosya No"
              value={form.file_number}
              onChange={(e) => setForm((f) => ({ ...f, file_number: e.target.value }))}
              sx={{ mb: 1 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Borç (TL)"
              type="number"
              value={form.debt_amount}
              onChange={(e) => setForm((f) => ({ ...f, debt_amount: e.target.value }))}
              inputProps={{ step: 0.01, min: 0 }}
              sx={{ mb: 1 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Son Ödeme Tarihi"
              type="date"
              value={form.last_payment_date}
              onChange={(e) => setForm((f) => ({ ...f, last_payment_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 1 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Not"
              multiline
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveNew}
                disabled={saving}
              >
                Kaydet
              </Button>
              <Button
                variant="outlined"
                onClick={handleSaveAndOpenDetail}
                disabled={saving}
              >
                Müşteri detayı
              </Button>
            </Box>
          </Box>
        )}

        {callId && (
          <FormControl fullWidth size="small" sx={{ mt: 2 }}>
            <InputLabel>Çağrı sonucu</InputLabel>
            <Select
              value={disposition}
              label="Çağrı sonucu"
              onChange={(e) => setDisposition(e.target.value)}
            >
              <MenuItem value="">
                <em>Seçiniz</em>
              </MenuItem>
              {DISPOSITIONS.map((d) => (
                <MenuItem key={d.value} value={d.value}>
                  {d.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Button
          sx={{ mt: 2 }}
          onClick={async () => {
            if (callId && disposition) {
              try {
                await api.patch(`/calls/${callId}`, { disposition_code: disposition });
              } catch (e) {
                console.error('Disposition update failed:', e);
              }
            }
            onClose();
          }}
        >
          Kapat
        </Button>
      </DialogContent>
    </Dialog>
  );
}
