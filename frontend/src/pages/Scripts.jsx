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
  Checkbox,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Scripts() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';
  const [scripts, setScripts] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', content: '', is_default: false });

  const load = () => api.get('/scripts').then((r) => setScripts(r.data));

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', content: 'Sayın {{first_name}} {{last_name}}, borcunuz {{debt_amount}} TL. {{file_number}}', is_default: false });
    setFormOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, content: s.content, is_default: s.is_default });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim() || !form.content?.trim()) return;
    try {
      if (editing) {
        await api.patch(`/scripts/${editing.id}`, form);
      } else {
        await api.post('/scripts', form);
      }
      setFormOpen(false);
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu scripti silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/scripts/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Scriptler (Tahsilat Metinleri)</Typography>
        {canEdit && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Yeni Script
          </Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Placeholder'lar: {'{{first_name}}'}, {'{{last_name}}'}, {'{{debt_amount}}'}, {'{{file_number}}'}
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ad</TableCell>
              <TableCell>Varsayılan</TableCell>
              {canEdit && <TableCell width={80} align="right">İşlem</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {scripts.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.is_default ? 'Evet' : '-'}</TableCell>
                {canEdit && (
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(s)}><EditIcon /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(s.id)}><DeleteIcon /></IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {canEdit && <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Script Düzenle' : 'Yeni Script'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField required label="Ad" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextField required label="İçerik" multiline rows={5} fullWidth value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
            <FormControlLabel control={<Checkbox checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />} label="Varsayılan script" />
            <Button variant="contained" onClick={handleSave}>Kaydet</Button>
          </Box>
        </DialogContent>
      </Dialog>}
    </Box>
  );
}
