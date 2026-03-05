import { useState, useEffect } from 'react';
import { Box, Typography, Paper, TextField, Button, Alert, FormControlLabel, Checkbox, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import api from '../utils/api';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [crmWebhookUrl, setCrmWebhookUrl] = useState('');
  const [crmWebhookSecret, setCrmWebhookSecret] = useState('');
  const [wallboardToken, setWallboardToken] = useState('');
  const [hasExistingSecret, setHasExistingSecret] = useState(false);
  const [clearSecret, setClearSecret] = useState(false);
  const [amiHost, setAmiHost] = useState('localhost');
  const [amiPort, setAmiPort] = useState('5038');
  const [amiUser, setAmiUser] = useState('amiuser');
  const [amiSecret, setAmiSecret] = useState('');
  const [hasAmiSecret, setHasAmiSecret] = useState(false);
  const [clearAmiSecret, setClearAmiSecret] = useState(false);
  const [amiDialTrunk, setAmiDialTrunk] = useState('');
  const [amiDialTech, setAmiDialTech] = useState('PJSIP');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    api.get('/settings')
      .then((r) => {
        setCrmWebhookUrl(r.data.crm_webhook_url || '');
        const s = r.data.crm_webhook_secret || '';
        setHasExistingSecret(s === '********' || s.length > 0);
        setCrmWebhookSecret(s === '********' ? '' : s);
        setWallboardToken(r.data.wallboard_public_token || '');
        setAmiHost(r.data.ami_host || '');
        setAmiPort(r.data.ami_port || '5038');
        setAmiUser(r.data.ami_user || '');
        setAmiDialTrunk(r.data.ami_dial_trunk || '');
        setAmiDialTech(r.data.ami_dial_tech || 'PJSIP');
        const as = r.data.ami_secret || '';
        setHasAmiSecret(as === '********' || as.length > 0);
        setAmiSecret(as === '********' ? '' : as);
      })
      .catch((e) => setLoadError(e.response?.data?.message || 'Ayarlar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaving(true);
    setMsg(null);
    const body = {
      crm_webhook_url: crmWebhookUrl || '',
      wallboard_public_token: wallboardToken || '',
      ami_host: amiHost || '',
      ami_port: amiPort || '5038',
      ami_user: amiUser || '',
      ami_dial_trunk: amiDialTrunk || '',
      ami_dial_tech: amiDialTech || 'PJSIP',
    };
    if (clearSecret) body.crm_webhook_secret = '';
    else if (crmWebhookSecret) body.crm_webhook_secret = crmWebhookSecret;
    if (clearAmiSecret) body.ami_secret = '';
    else if (amiSecret) body.ami_secret = amiSecret;
    api.patch('/settings', body)
      .then((r) => {
        setCrmWebhookUrl(r.data.crm_webhook_url || '');
        const s = r.data.crm_webhook_secret || '';
        setHasExistingSecret(s === '********' || s.length > 0);
        setCrmWebhookSecret(s === '********' ? '' : s);
        setClearSecret(false);
        setWallboardToken(r.data.wallboard_public_token || '');
        setAmiHost(r.data.ami_host || '');
        setAmiPort(r.data.ami_port || '5038');
        setAmiUser(r.data.ami_user || '');
        setAmiDialTrunk(r.data.ami_dial_trunk || '');
        setAmiDialTech(r.data.ami_dial_tech || 'PJSIP');
        const as = r.data.ami_secret || '';
        setHasAmiSecret(as === '********' || as.length > 0);
        setAmiSecret(as === '********' ? '' : as);
        setClearAmiSecret(false);
        setMsg({ type: 'success', text: 'Kaydedildi. AMI bağlantısı yenilendi.' });
      })
      .catch((e) => {
        setMsg({ type: 'error', text: e.response?.data?.message || 'Kaydetme hatası' });
      })
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>Sistem Ayarları</Typography>
        <Alert severity="error" sx={{ mt: 2 }}>{loadError}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => window.location.reload()}>Yeniden Dene</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Sistem Ayarları
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          CRM Webhook (Admin panelinden yapılandırma)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Çağrı bitiminde CRM'ye POST atılacak URL. .env ile de yapılandırılabilir; panel önceliklidir.
        </Typography>
        <TextField
          fullWidth
          size="small"
          label="CRM Webhook URL"
          value={crmWebhookUrl}
          onChange={(e) => setCrmWebhookUrl(e.target.value)}
          placeholder="https://crm.example.com/api/webhooks/opencc"
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          size="small"
          type="password"
          label="Webhook Secret (X-Webhook-Signature)"
          value={crmWebhookSecret}
          onChange={(e) => {
            setCrmWebhookSecret(e.target.value);
            setClearSecret(false);
          }}
          placeholder={hasExistingSecret ? 'Değiştirmek için yeni değer girin' : ''}
          helperText={hasExistingSecret ? 'Secret yapılandırılmış. Değiştirmek için yeni değer girin veya kaldır.' : ''}
          sx={{ mb: 1 }}
        />
        {hasExistingSecret && (
          <FormControlLabel
            control={<Checkbox checked={clearSecret} onChange={(e) => setClearSecret(e.target.checked)} color="error" />}
            label="Secret'ı kaldır (kaydetmede)"
            sx={{ mb: 2, display: 'block' }}
          />
        )}
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          Kaydet
        </Button>
        {msg && (
          <Alert severity={msg.type} sx={{ mt: 2 }} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Asterisk AMI Bağlantısı
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Screen Pop, Click-to-Call ve ChanSpy için AMI bağlantı bilgileri. Panel önceliklidir; .env fallback olarak kullanılır.
        </Typography>
        <TextField
          fullWidth
          size="small"
          label="AMI Host"
          value={amiHost}
          onChange={(e) => setAmiHost(e.target.value)}
          placeholder="Docker: asterisk | Yerel: localhost"
          sx={{ mb: 1 }}
        />
        <TextField
          fullWidth
          size="small"
          label="AMI Port"
          value={amiPort}
          onChange={(e) => setAmiPort(e.target.value)}
          placeholder="5038"
          sx={{ mb: 1 }}
        />
        <TextField
          fullWidth
          size="small"
          label="AMI User"
          value={amiUser}
          onChange={(e) => setAmiUser(e.target.value)}
          placeholder="admin"
          sx={{ mb: 1 }}
        />
        <TextField
          fullWidth
          size="small"
          type="password"
          label="AMI Secret"
          value={amiSecret}
          onChange={(e) => {
            setAmiSecret(e.target.value);
            setClearAmiSecret(false);
          }}
          placeholder={hasAmiSecret ? 'Değiştirmek için yeni değer girin' : ''}
          helperText={hasAmiSecret ? 'Secret yapılandırılmış.' : ''}
          sx={{ mb: 1 }}
        />
        {hasAmiSecret && (
          <FormControlLabel
            control={<Checkbox checked={clearAmiSecret} onChange={(e) => setClearAmiSecret(e.target.checked)} color="error" />}
            label="AMI Secret'ı kaldır (kaydetmede)"
            sx={{ mb: 2, display: 'block' }}
          />
        )}
        <TextField
          fullWidth
          size="small"
          label="Dış Arama Trunk (AMI_DIAL_TRUNK)"
          value={amiDialTrunk}
          onChange={(e) => setAmiDialTrunk(e.target.value)}
          placeholder="fct-trunk (FCT/PSTN için)"
          helperText="Boş bırakılırsa dahili aramalar çalışır. PSTN için trunk adı girin (örn. fct-trunk)."
          sx={{ mb: 1 }}
        />
        <TextField
          fullWidth
          size="small"
          label="Dial Teknolojisi (AMI_DIAL_TECH)"
          value={amiDialTech}
          onChange={(e) => setAmiDialTech(e.target.value)}
          placeholder="PJSIP"
          sx={{ mb: 2 }}
        />
        <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          Asterisk Ayarlarını Kaydet
        </Button>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Wallboard TV Modu
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          TV/ekranlarda login olmadan gösterim için token. URL: /wallboard/public?token=TOKEN
        </Typography>
        <TextField
          fullWidth
          size="small"
          label="Wallboard Public Token"
          value={wallboardToken}
          onChange={(e) => setWallboardToken(e.target.value)}
          placeholder="örn: tv-wallboard-123"
        />
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Bağlantı Bilgileri</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Backend API: <code>{import.meta.env.VITE_API_URL || window.location.origin}</code>
        </Typography>
        <Typography variant="body2">
          WebSocket: <code>{window.location.origin}/socket.io</code>
        </Typography>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Environment (.env) — Fallback</Typography>
        <Typography variant="body2" sx={{ mt: 1 }} component="div">
          Panelden yapılandırılmayan değerler için .env fallback kullanılır.
          <br />
          <code>AMI_*</code>, <code>CRM_WEBHOOK_*</code>
        </Typography>
        <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
          Detay: docs/SETUP_GUIDE.md, docs/CRM_INTEGRATION.md
        </Typography>
      </Paper>
    </Box>
  );
}
