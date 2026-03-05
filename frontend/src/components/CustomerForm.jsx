import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, TextField, Button, Box, Alert, Grid } from '@mui/material';
import api from '../utils/api';

// 515 Borçlu GSM Raporu lead.xlsx ile aynı sıra ve sütun sayısı (16)
const BORCLU_GSM_FIELDS = [
  { key: 'takip_id', label: 'Takip ID' },
  { key: 'dosya_transfer_tarihi', label: 'Dosya Transfer Tarihi', type: 'date' },
  { key: 'buro_adi', label: 'Büro Adı' },
  { key: 'first_name', label: 'Adı' },
  { key: 'last_name', label: 'Soyadı' },
  { key: 'dosya_asamasi', label: 'Dosya Aşaması' },
  { key: 'icrada_acilis_tarihi', label: 'İcrada Açılış Tarihi', type: 'date' },
  { key: 'kapanis_tipi', label: 'Kapanış Tipi' },
  { key: 'kapanis_tarihi', label: 'Kapanış Tarihi', type: 'date' },
  { key: 'bildirim_tarihi', label: 'Bildirim Tarihi', type: 'date' },
  { key: 'icra_dairesi', label: 'İcra Dairesi' },
  { key: 'icra_no', label: 'İcra No' },
  { key: 'tckn', label: 'TCKN' },
  { key: 'phone_number', label: 'Borçlu GSM', required: true },
  { key: 'fatura_id', label: 'Fatura ID' },
  { key: 'musteri_no', label: 'Müşteri No' },
];

const getEmptyForm = () => {
  const o = {};
  BORCLU_GSM_FIELDS.forEach(({ key }) => { o[key] = ''; });
  return o;
};

export default function CustomerForm({ open, onClose, onSaved, editMode, initialData }) {
  const [error, setError] = useState(null);
  const [form, setForm] = useState(getEmptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && initialData) {
      const next = getEmptyForm();
      BORCLU_GSM_FIELDS.forEach(({ key }) => {
        const v = initialData[key];
        if (v != null && v !== '') {
          next[key] = typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/) ? v.slice(0, 10) : String(v);
        }
      });
      setForm(next);
    } else if (!editMode) {
      setForm(getEmptyForm());
    }
  }, [open, initialData, editMode]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      if (payload.debt_amount === '') delete payload.debt_amount;
      else payload.debt_amount = parseFloat(payload.debt_amount);
      BORCLU_GSM_FIELDS.forEach(({ key }) => {
        if (payload[key] === '') delete payload[key];
      });
      if (payload.debt_amount !== undefined && isNaN(payload.debt_amount)) delete payload.debt_amount;
      if (editMode && initialData?.id) {
        await api.patch(`/customers/${initialData.id}`, payload);
      } else {
        await api.post('/customers', payload);
        setForm(getEmptyForm());
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Kaydetme hatası');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editMode ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            {BORCLU_GSM_FIELDS.map(({ key, label, type, required, multiline }) => (
              <Grid item xs={12} sm={6} key={key}>
                <TextField
                  fullWidth
                  size="small"
                  required={!!required}
                  label={label}
                  type={type || 'text'}
                  multiline={!!multiline}
                  rows={multiline ? 2 : undefined}
                  value={form[key] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  InputLabelProps={type === 'date' ? { shrink: true } : undefined}
                  inputProps={type === 'number' ? { step: 0.01, min: 0 } : undefined}
                />
              </Grid>
            ))}
          </Grid>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ mt: 2 }}>
            Kaydet
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
