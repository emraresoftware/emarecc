import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, TextField, Button, Paper, Typography, Alert } from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import api from '../utils/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const navigate = useNavigate();

  const [token, setToken] = useState(tokenParam || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tokenParam) setToken(tokenParam);
  }, [tokenParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token.trim()) {
      setError('Geçerli bir şifre sıfırlama bağlantısı gerekli.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token: token.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Şifre güncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
        <Paper sx={{ p: 4, maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <LockResetIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h6" color="success.main" gutterBottom>
            Şifreniz güncellendi
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Giriş sayfasına yönlendiriliyorsunuz...
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Typography variant="h5" gutterBottom>
          Yeni Şifre Belirle
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Şifrenizi girin ve tekrar edin.
        </Typography>
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {!tokenParam && (
            <TextField
              fullWidth
              size="small"
              label="Sıfırlama token'ı"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="URL'den veya e-postanızdan aldığınız token"
              sx={{ mb: 1 }}
            />
          )}
          <TextField
            fullWidth
            type="password"
            label="Yeni şifre"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            margin="normal"
            required
            inputProps={{ minLength: 6 }}
          />
          <TextField
            fullWidth
            type="password"
            label="Şifre tekrar"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={loading}>
            Şifreyi Güncelle
          </Button>
          <Button fullWidth sx={{ mt: 1 }} onClick={() => navigate('/login')}>
            Giriş sayfasına dön
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
