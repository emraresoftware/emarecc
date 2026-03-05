import { Dialog, DialogTitle, DialogContent, Button, Box } from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { useSip } from '../context/SipContext';

export default function SipIncomingModal() {
  const sip = useSip();
  if (!sip) return null;
  const { state, incomingCaller, answer, decline } = sip;
  const open = sip.enabled && state === 'incoming';

  if (!open) return null;

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: 'error.main',
            animation: 'pulse 1.2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
              '50%': { opacity: 0.6, transform: 'scale(1.2)' },
            },
          }}
        />
        WebRTC Gelen Arama
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          {incomingCaller}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<PhoneIcon />}
            onClick={answer}
          >
            Cevapla
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<CallEndIcon />}
            onClick={decline}
          >
            Reddet
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
