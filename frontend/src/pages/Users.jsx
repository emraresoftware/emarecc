import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  IconButton,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../utils/api';
import UserForm from '../components/UserForm';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [skillsOpen, setSkillsOpen] = useState(null);
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState({ skill: '', level: 5 });

  const load = () => {
    const params = statusFilter ? { status: statusFilter } : {};
    api.get('/users', { params }).then((r) => setUsers(r.data));
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const openSkills = (u) => {
    setSkillsOpen(u);
    api.get(`/skills/user/${u.id}`).then((r) => setSkills(r.data)).catch(() => setSkills([]));
    setNewSkill({ skill: '', level: 5 });
  };

  const addSkill = async () => {
    if (!newSkill.skill?.trim() || !skillsOpen) return;
    try {
      await api.post(`/skills/user/${skillsOpen.id}`, newSkill);
      api.get(`/skills/user/${skillsOpen.id}`).then((r) => setSkills(r.data));
      setNewSkill({ skill: '', level: 5 });
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const removeSkill = async (skillId) => {
    try {
      await api.delete(`/skills/user/${skillsOpen.id}/${skillId}`);
      setSkills((s) => s.filter((x) => x.id !== skillId));
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const updateStatus = async (userId, status) => {
    try {
      await api.patch(`/users/${userId}/status`, { status });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Kullanıcılar</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditUser(null); setFormOpen(true); }}>
          Yeni Kullanıcı
        </Button>
      </Box>
      <FormControl size="small" sx={{ minWidth: 120, mb: 2 }}>
        <InputLabel>Durum</InputLabel>
        <Select
          value={statusFilter}
          label="Durum"
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <MenuItem value="">Tümü</MenuItem>
          <MenuItem value="ready">Ready</MenuItem>
          <MenuItem value="paused">Paused</MenuItem>
          <MenuItem value="offline">Offline</MenuItem>
        </Select>
      </FormControl>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Kullanıcı</TableCell>
              <TableCell>Extension</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Yetenekler</TableCell>
              <TableCell>Durum</TableCell>
              <TableCell>İşlem</TableCell>
              <TableCell width={50} />
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.extension || '-'}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>
                  {u.role === 'agent' && (
                    <IconButton size="small" onClick={() => openSkills(u)} title="Yetenekler">
                      <StarIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={u.status}
                    size="small"
                    color={u.status === 'ready' ? 'success' : u.status === 'paused' ? 'warning' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  {u.role === 'agent' && u.status !== 'ready' && (
                    <Chip label="Ready" size="small" onClick={() => updateStatus(u.id, 'ready')} sx={{ mr: 0.5 }} />
                  )}
                  {u.role === 'agent' && u.status === 'ready' && (
                    <Chip label="Pause" size="small" variant="outlined" onClick={() => updateStatus(u.id, 'paused')} />
                  )}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => { setEditUser(u); setFormOpen(true); }}>
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <UserForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} editUser={editUser} />

      <Dialog open={!!skillsOpen} onClose={() => setSkillsOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Yetenekler — {skillsOpen?.username}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, mb: 2 }}>
            {skills.map((s) => (
              <Chip
                key={s.id}
                label={`${s.skill} (${s.level})`}
                size="small"
                onDelete={() => removeSkill(s.id)}
                deleteIcon={<DeleteIcon />}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              label="Yetenek"
              value={newSkill.skill}
              onChange={(e) => setNewSkill((x) => ({ ...x, skill: e.target.value }))}
              placeholder="örn. ingilizce, satış"
            />
            <TextField
              size="small"
              type="number"
              label="Seviye"
              value={newSkill.level}
              onChange={(e) => setNewSkill((x) => ({ ...x, level: parseInt(e.target.value, 10) || 5 }))}
              inputProps={{ min: 1, max: 10 }}
              sx={{ width: 80 }}
            />
            <Button variant="contained" size="small" onClick={addSkill} disabled={!newSkill.skill?.trim()}>
              Ekle
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
