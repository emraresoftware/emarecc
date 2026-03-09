import { Dialog, DialogTitle, DialogContent, Button, Box, Typography } from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import CallEndIcon from '@mui/icons-material/CallEnd';
import PersonIcon from '@mui/icons-material/Person';
import { useSip } from '../context/SipContext';
import { useEffect } from 'react';

export default function SipIncomingModal() {
  const sip = useSip();
  if (!sip) return null;
  const { state, incomingCaller, answer, decline } = sip;
  const open = sip.enabled && state === 'incoming';

  useEffect(() => {
    console.log('[SipIncomingModal] state:', state, 'enabled:', sip.enabled, 'caller:', incomingCaller, 'open:', open);
  }, [state, sip.enabled, incomingCaller, open]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          border: '3px solid #4caf50',
          borderRadius: 3,
          boxShadow: '0 0 30px rgba(76, 175, 80, 0.4)',
          animation: 'dialogPulse 1.5s ease-in-out infinite',
          '@keyframes dialogPulse': {
            '0%, 100%': { boxShadow: '0 0 20px rgba(76, 175, 80, 0.3)' },
            '50%': { boxShadow: '0 0 40px rgba(76, 175, 80, 0.6)' },
          },
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#e8f5e9' }}>
        <Box
          sx={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: '#4caf50',
            animation: 'pulse 1s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
              '50%': { opacity: 0.5, transform: 'scale(1.3)' },
            },
          }}
        />
        <Typography variant="h6" fontWeight="bold">📞 Gelen Arama</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
          <PersonIcon sx={{ fontSize: 40, color: '#666' }} />
          <Typography variant="h5" fontWeight="bold" color="text.primary">
            {incomingCaller || 'Bilinmeyen'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<PhoneIcon />}
            onClick={answer}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', borderRadius: 3 }}
          >
            Cevapla
          </Button>
          <Button
            variant="contained"
            color="error"
            size="large"
            startIcon={<CallEndIcon />}
            onClick={decline}
            sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', borderRadius: 3 }}
          >
            Reddet
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
