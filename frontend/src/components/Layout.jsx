import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PhoneIcon from '@mui/icons-material/Phone';
import PeopleIcon from '@mui/icons-material/People';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import AssessmentIcon from '@mui/icons-material/Assessment';
import GroupIcon from '@mui/icons-material/Group';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import QueueIcon from '@mui/icons-material/Queue';
import DialerIcon from '@mui/icons-material/DialerSip';
import DescriptionIcon from '@mui/icons-material/Description';
import CampaignIcon from '@mui/icons-material/Campaign';
import SettingsIcon from '@mui/icons-material/Settings';
import RouterIcon from '@mui/icons-material/Router';
import PersonIcon from '@mui/icons-material/Person';
import ChatIcon from '@mui/icons-material/Chat';
import LogoutIcon from '@mui/icons-material/Logout';
import TerminalIcon from '@mui/icons-material/Terminal';
import SimCardIcon from '@mui/icons-material/SimCard';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import SoftphoneWidget from './SoftphoneWidget';
import ScreenPopModal from './ScreenPopModal';
import SipIncomingModal from './SipIncomingModal';
import QuickDialDialog from './QuickDialDialog';

const drawerWidth = 240;

export default function Layout({ children }) {
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [screenPop, setScreenPop] = useState({ open: false, data: null });
  const [quickDialOpen, setQuickDialOpen] = useState(false);
  const { user, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  const originalTitle = useRef(document.title);

  const playRingTone = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (freq, start) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
        osc.start(start);
        osc.stop(start + 0.15);
      };
      playBeep(800, 0);
      playBeep(800, 0.2);
      playBeep(800, 0.4);
    } catch {}
  };

  const showBrowserNotification = (callerId, customerName) => {
    if (!('Notification' in window)) return;
    const title = 'Gelen Arama';
    const body = customerName
      ? `${customerName} – ${callerId}`
      : callerId || 'Bilinmeyen numara';
    if (Notification.permission === 'granted') {
      const n = new Notification(title, { body, icon: '/favicon.ico' });
      n.onclick = () => {
        n.close();
        window.focus();
      };
      return;
    }
    if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((p) => {
        if (p === 'granted') {
          const n = new Notification(title, { body, icon: '/favicon.ico' });
          n.onclick = () => {
            n.close();
            window.focus();
          };
        }
      });
    }
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('SCREEN_POP', (data) => {
      setScreenPop({ open: true, data });
      document.title = `🔔 Gelen Arama - ${data?.callerId || 'Bilinmeyen'} | OpenCC`;
      playRingTone();
      const name = data?.customer
        ? [data.customer.first_name, data.customer.last_name].filter(Boolean).join(' ')
        : null;
      showBrowserNotification(data?.callerId, name || undefined);
    });
    return () => socket.off('SCREEN_POP');
  }, [socket]);

  const handleScreenPopClose = () => {
    setScreenPop({ open: false, data: null });
    document.title = originalTitle.current;
  };
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/customers', label: 'Müşteriler', icon: <PeopleIcon /> },
    { path: '/preview-dialer', label: 'Preview Dialer', icon: <DialerIcon /> },
    { path: '/wallboard', label: 'Wallboard', icon: <SpaceDashboardIcon /> },
    { path: '/reports', label: 'Raporlar', icon: <AssessmentIcon /> },
    { path: '/queues', label: 'Kuyruklar', icon: <QueueIcon /> },
    { path: '/scripts', label: 'Scriptler', icon: <DescriptionIcon /> },
    { path: '/chat', label: 'Sohbet', icon: <ChatIcon /> },
    ...(user?.role === 'admin' || user?.role === 'supervisor'
      ? [
          { path: '/active-calls', label: 'Aktif Çağrılar', icon: <CallMergeIcon /> },
          { path: '/users', label: 'Kullanıcılar', icon: <GroupIcon /> },
          { path: '/sessions', label: 'Canlı Oturumlar', icon: <PersonIcon /> },
          { path: '/campaigns', label: 'Kampanyalar', icon: <CampaignIcon /> },
          { path: '/settings', label: 'Ayarlar', icon: <SettingsIcon /> },
          { path: '/softphone-settings', label: 'Softphone Ayarları', icon: <DialerIcon /> },
          { path: '/logs', label: 'Loglar', icon: <TerminalIcon /> },
          { path: '/fct-ports', label: 'FCT Gateway', icon: <SimCardIcon /> },
          { path: '/asterisk', label: 'Asterisk Durum', icon: <RouterIcon /> },
        ]
      : []),
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => setOpen(!open)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            OpenCC
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.username} ({user?.extension || user?.role})
          </Typography>
          {user?.extension && (
            <IconButton color="inherit" onClick={() => setQuickDialOpen(true)} title="Numara Ara">
              <PhoneIcon />
            </IconButton>
          )}
          <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <LogoutIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <MenuItem onClick={() => { logout(); setAnchorEl(null); }}>
              Çıkış
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="persistent"
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', top: 64 },
        }}
      >
        <List>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.path}
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        {children}
      </Box>
      {user?.extension && <SoftphoneWidget />}
      <ScreenPopModal
        open={screenPop.open}
        onClose={handleScreenPopClose}
        data={screenPop.data}
      />
      <SipIncomingModal />
      <QuickDialDialog open={quickDialOpen} onClose={() => setQuickDialOpen(false)} />
      <Snackbar
        open={screenPop.open}
        autoHideDuration={null}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert severity="info" icon={<PhoneIcon />} variant="filled">
          Gelen arama: {screenPop.data?.callerId || 'Bilinmeyen'}
        </Alert>
      </Snackbar>
    </Box>
  );
}
