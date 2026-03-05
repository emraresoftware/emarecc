import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, TextField, Button, Paper, Typography, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const LOGIN_REMEMBER_KEY = 'opencc_last_username';

export default function Login() {
  const [username, setUsername] = useState(() => localStorage.getItem(LOGIN_REMEMBER_KEY) || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setForgotMessage('');
    if (!username.trim()) {
      setError('Kullanıcı adı girin.');
      return;
    }
    setForgotLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { username: username.trim() });
      navigate(`/reset-password?token=${data.token}`);
    } catch (err) {
      setForgotMessage(err.response?.data?.message || 'İşlem başarısız.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const cleanUsername = username?.trim();
      const cleanPassword = password?.trim();
      await login(cleanUsername, cleanPassword);
      if (cleanUsername) localStorage.setItem(LOGIN_REMEMBER_KEY, cleanUsername);
      navigate('/');
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      const networkMessage = err?.message;
      setError(apiMessage || networkMessage || 'Giriş başarısız (ağ/sertifika hatası olabilir)');
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Typography variant="h5" gutterBottom>
          OpenCC - Çağrı Merkezi
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {showForgot ? 'Şifrenizi sıfırlamak için kullanıcı adınızı girin' : 'Giriş yapın'}
        </Typography>

        {showForgot ? (
          <form onSubmit={handleForgotSubmit}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {forgotMessage && <Alert severity="error" sx={{ mb: 2 }}>{forgotMessage}</Alert>}
            <TextField
              fullWidth
              label="Kullanıcı adı"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
            />
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={forgotLoading}>
              Şifre Sıfırlama Bağlantısı Al
            </Button>
            <Button fullWidth sx={{ mt: 1 }} onClick={() => { setShowForgot(false); setForgotMessage(''); }}>
              Giriş sayfasına dön
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Kullanıcı adı"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              type="password"
              label="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
              Giriş
            </Button>
            <Button fullWidth sx={{ mt: 1 }} size="small" onClick={() => setShowForgot(true)}>
              Şifremi unuttum
            </Button>
          </form>
        )}
      </Paper>
    </Box>
  );
}
