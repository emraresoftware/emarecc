import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  List,
  ListItem,
  ListItemText,
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
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const STRATEGIES = [
  { value: 'ring-all', label: 'Ring All' },
  { value: 'round-robin', label: 'Round Robin' },
  { value: 'least-recent', label: 'Least Recent' },
  { value: 'fewest-calls', label: 'Fewest Calls' },
];

export default function Queues() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'supervisor';
  const [queues, setQueues] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', strategy: 'ring-all' });
  const [membersOpen, setMembersOpen] = useState(null);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [addAgent, setAddAgent] = useState('');

  const load = () => api.get('/queues').then((r) => setQueues(r.data));

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (canEdit) api.get('/users').then((r) => setUsers(r.data)).catch(() => {});
  }, [canEdit]);

  const loadMembers = (q) => {
    if (q?.id) api.get(`/queues/${q.id}/members`).then((r) => setMembers(r.data)).catch(() => setMembers([]));
  };

  const openMembers = (q) => {
    setMembersOpen(q);
    loadMembers(q);
    setAddAgent('');
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', strategy: 'ring-all' });
    setFormOpen(true);
  };

  const openEdit = (q) => {
    setEditing(q);
    setForm({ name: q.name, strategy: q.strategy || 'ring-all' });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing) {
        await api.patch(`/queues/${editing.id}`, form);
      } else {
        await api.post('/queues', form);
      }
      setFormOpen(false);
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu kuyruğu silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/queues/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Kuyruklar</Typography>
        {canEdit && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Yeni Kuyruk
          </Button>
        )}
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ad</TableCell>
              <TableCell>Strateji</TableCell>
              <TableCell>Üyeler</TableCell>
              {canEdit && <TableCell align="right">İşlem</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {queues.map((q) => (
              <TableRow key={q.id}>
                <TableCell>{q.name}</TableCell>
                <TableCell>{STRATEGIES.find((s) => s.value === q.strategy)?.label || q.strategy}</TableCell>
                <TableCell>
                  <Button size="small" startIcon={<PersonAddIcon />} onClick={() => openMembers(q)}>
                    {membersOpen?.id === q.id ? `${members.length} ajan` : 'Üyeler'}
                  </Button>
                </TableCell>
                {canEdit && (
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(q)}><EditIcon /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(q.id)}><DeleteIcon /></IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!membersOpen} onClose={() => setMembersOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Kuyruk Üyeleri — {membersOpen?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {canEdit && (
              <>
                <FormControl size="small">
                  <InputLabel>Ajan Ekle</InputLabel>
                  <Select value={addAgent} label="Ajan Ekle" onChange={(e) => setAddAgent(e.target.value)}>
                    <MenuItem value="">Seçiniz</MenuItem>
                    {users.filter((u) => u.role === 'agent' && !members.find((m) => m.user_id === u.id)).map((u) => (
                      <MenuItem key={u.id} value={u.id}>{u.username} ({u.extension})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="outlined" size="small" onClick={async () => {
                  if (!addAgent || !membersOpen) return;
                  try {
                    await api.post(`/queues/${membersOpen.id}/members`, { user_id: addAgent });
                    loadMembers(membersOpen);
                    setAddAgent('');
                  } catch (e) { alert(e.response?.data?.message || e.message); }
                }} disabled={!addAgent}>
                  Ekle
                </Button>
              </>
            )}
            <List dense>
              {members.map((m) => (
                <ListItem key={m.id} secondaryAction={canEdit ? (
                  <IconButton edge="end" size="small" onClick={async () => {
                    await api.delete(`/queues/${membersOpen.id}/members/${m.user_id}`);
                    loadMembers(membersOpen);
                  }}>
                    <PersonRemoveIcon />
                  </IconButton>
                ) : null}>
                  <ListItemText primary={`${m.username} (${m.extension})`} />
                </ListItem>
              ))}
            </List>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Kuyruk Düzenle' : 'Yeni Kuyruk'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              required
              label="Ad"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <FormControl>
              <InputLabel>Strateji</InputLabel>
              <Select
                value={form.strategy}
                label="Strateji"
                onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}
              >
                {STRATEGIES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleSave}>
              Kaydet
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
