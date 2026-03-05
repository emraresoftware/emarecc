import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, TextField, Button, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import api from '../utils/api';

export default function UserForm({ open, onClose, onSaved, editUser }) {
  const [form, setForm] = useState({ username: '', password: '', extension: '', role: 'agent' });
  const [saving, setSaving] = useState(false);
  const [extensions, setExtensions] = useState([]);

  useEffect(() => {
    if (!open) return;
    api
      .get('/users/extensions')
      .then((r) => {
        let list = r.data?.available || [];
        if (editUser?.extension && !list.includes(editUser.extension)) {
          list = [editUser.extension, ...list];
        }
        setExtensions(list);
      })
      .catch(() => setExtensions([]));
    if (editUser) {
      setForm({ username: editUser.username, password: '', extension: editUser.extension || '', role: editUser.role });
    } else {
      setForm({ username: '', password: '', extension: '', role: 'agent' });
    }
  }, [editUser, open]);

  const handleSave = async () => {
    if (!form.username) return;
    if (!editUser && !form.password) return;
    setSaving(true);
    try {
      if (editUser) {
        const body = { username: form.username, extension: form.extension, role: form.role };
        if (form.password) body.password = form.password;
        await api.patch(`/users/${editUser.id}`, body);
      } else {
        await api.post('/users', form);
      }
      setForm({ username: '', password: '', extension: '', role: 'agent' });
      onSaved?.();
      onClose();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          <TextField
            required
            label="Kullanıcı adı"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            disabled={!!editUser}
          />
          <TextField
            type="password"
            label={editUser ? 'Yeni şifre (boş bırakın = değişmez)' : 'Şifre'}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required={!editUser}
          />
          <FormControl>
            <InputLabel>Extension</InputLabel>
            <Select
              value={form.extension || ''}
              label="Extension"
              onChange={(e) => setForm((f) => ({ ...f, extension: e.target.value || '' }))}
            >
              <MenuItem value="">Yok</MenuItem>
              {extensions.map((ext) => (
                <MenuItem key={ext} value={ext}>
                  {ext}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Rol</InputLabel>
            <Select
              value={form.role}
              label="Rol"
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <MenuItem value="agent">Agent</MenuItem>
              <MenuItem value="supervisor">Supervisor</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {editUser ? 'Kaydet' : 'Ekle'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
