import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Web } from 'sip.js';
import { useAuth } from './AuthContext';

const SipContext = createContext(null);

const WS_URL = import.meta.env.VITE_SIP_WS_URL || (typeof window !== 'undefined' ? `wss://${window.location.host}/ws` : '');
const SIP_DOMAIN = import.meta.env.VITE_SIP_DOMAIN || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
const SIP_SECRET = import.meta.env.VITE_SIP_SECRET || 'webrtc123';

export function SipProvider({ children }) {
  const { user } = useAuth();
  const [simpleUser, setSimpleUser] = useState(null);
  const [state, setState] = useState('disconnected'); // disconnected | connecting | registered | incoming | connected
  const [incomingCaller, setIncomingCaller] = useState('');
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const reconnectTimerRef = useRef(null);
  const healthTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectInFlightRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const ext = user?.extension != null ? String(user.extension) : '';
  const hasConfig = WS_URL && SIP_SECRET && ext;

  useEffect(() => {
    if (!hasConfig) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (healthTimerRef.current) {
        clearInterval(healthTimerRef.current);
        healthTimerRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      reconnectInFlightRef.current = false;
      setSimpleUser(null);
      setState('disconnected');
      return;
    }

    let disposed = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const clearHealth = () => {
      if (healthTimerRef.current) {
        clearInterval(healthTimerRef.current);
        healthTimerRef.current = null;
      }
    };

    const aor = `sip:${ext}@${SIP_DOMAIN}`;

    // Create a hidden audio element for remote audio
    let remoteAudio = document.getElementById('sip-remote-audio');
    if (!remoteAudio) {
      remoteAudio = document.createElement('audio');
      remoteAudio.id = 'sip-remote-audio';
      remoteAudio.autoplay = true;
      document.body.appendChild(remoteAudio);
    }

    const scheduleReconnect = () => {
      if (disposed || reconnectTimerRef.current || reconnectInFlightRef.current) return;

      const attempt = reconnectAttemptsRef.current;
      const delayMs = Math.min(3000 * 2 ** attempt, 30000);
      reconnectTimerRef.current = setTimeout(async () => {
        reconnectTimerRef.current = null;
        if (disposed || reconnectInFlightRef.current) return;

        reconnectInFlightRef.current = true;
        try {
          console.log('[SIP] 🔄 Yeniden bağlanılıyor...', { attempt: reconnectAttemptsRef.current + 1, delayMs });
          setState('connecting');
          await su.connect();
          await su.register();
        } catch (retryErr) {
          reconnectAttemptsRef.current += 1;
          console.error('[SIP] ❌ Yeniden bağlantı başarısız', {
            attempt: reconnectAttemptsRef.current,
            message: retryErr?.message || retryErr,
          });
          setState('disconnected');
          scheduleReconnect();
        } finally {
          reconnectInFlightRef.current = false;
        }
      }, delayMs);
    };

    const startHealthLoop = () => {
      clearHealth();
      healthTimerRef.current = setInterval(async () => {
        if (disposed || reconnectInFlightRef.current) return;
        if (document.visibilityState === 'hidden') return;
        const currentState = stateRef.current;
        if (currentState === 'registered' || currentState === 'connected' || currentState === 'incoming') return;
        scheduleReconnect();
      }, 7000);
    };

    const su = new Web.SimpleUser(WS_URL, {
      aor,
      media: {
        remote: {
          audio: remoteAudio,
        },
      },
      userAgentOptions: {
        authorizationUsername: ext,
        authorizationPassword: SIP_SECRET,
        logLevel: 'debug',
      },
      delegate: {
        onServerConnect: () => {
          console.log('[SIP] ✅ WebSocket bağlantısı kuruldu');
          setState('connecting');
        },
        onServerDisconnect: (err) => {
          console.error('[SIP] ❌ WebSocket bağlantısı koptu', err?.message || err || '');
          setState('disconnected');
          if (err) setError(err.message);
          scheduleReconnect();
        },
        onRegistered: () => {
          console.log('[SIP] ✅ Kayıt başarılı — dahili:', ext);
          setState('registered');
          setError('');
          reconnectAttemptsRef.current = 0;
          reconnectInFlightRef.current = false;
          clearReconnect();
          startHealthLoop();
        },
        onUnregistered: () => {
          console.warn('[SIP] ⚠️ Kayıt silindi');
          setState('disconnected');
          clearHealth();
          scheduleReconnect();
        },
        onCallReceived: () => {
          console.log('[SIP] 📞 Gelen arama algılandı');
          setState('incoming');
          setIncomingCaller('Gelen arama');
        },
        onCallAnswered: () => {
          console.log('[SIP] 📞 Arama cevaplandı');
          setState('connected');
          setIsMuted(su?.isMuted?.() ?? false);
          setIsHeld(false);
        },
        onCallHangup: () => {
          console.log('[SIP] 📞 Arama sonlandı');
          setState('registered');
          setIncomingCaller('');
          setIsMuted(false);
          setIsHeld(false);
          startHealthLoop();
        },
        onCallHold: (held) => {
          console.log('[SIP]', held ? '⏸️ Bekletmeye alındı' : '▶️ Bekletme kaldırıldı');
          setIsHeld(!!held);
        },
      },
    });

    const triggerReconnectNow = () => {
      clearReconnect();
      reconnectAttemptsRef.current = 0;
      scheduleReconnect();
    };

    const onWindowOnline = () => {
      console.log('[SIP] 🌐 Ağ geri geldi, reconnect tetikleniyor');
      triggerReconnectNow();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerReconnectNow();
      }
    };

    window.addEventListener('online', onWindowOnline);
    document.addEventListener('visibilitychange', onVisibility);

    setSimpleUser(su);
    setError('');
    setState('connecting');

    console.log('[SIP] 🔧 Bağlantı başlatılıyor...', { wsUrl: WS_URL, aor, domain: SIP_DOMAIN, ext });

    (async () => {
      try {
        await su.connect();
        console.log('[SIP] ✅ WebSocket bağlandı, kayıt yapılıyor...');
        await su.register();
        console.log('[SIP] ✅ REGISTER gönderildi');
      } catch (e) {
        const msg = e?.message || e?.response?.data?.message || String(e);
        console.error('[SIP] ❌ Bağlantı/kayıt hatası:', msg, e);
        setError(msg.includes('401') ? 'SIP: Yetki reddedildi (kullanıcı/şifre kontrol et)' : msg || 'SIP bağlantı hatası');
        setState('disconnected');
        scheduleReconnect();
      }
    })();

    return () => {
      disposed = true;
      clearReconnect();
      clearHealth();
      reconnectAttemptsRef.current = 0;
      reconnectInFlightRef.current = false;
      window.removeEventListener('online', onWindowOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      su.unregister?.().catch(() => {});
      su.disconnect?.().catch(() => {});
      setSimpleUser(null);
    };
  }, [hasConfig, ext]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = useCallback(async () => {
    if (!simpleUser || state !== 'incoming') return;
    try {
      await simpleUser.answer();
    } catch (e) {
      setError(e.message);
    }
  }, [simpleUser, state]);

  const decline = useCallback(async () => {
    if (!simpleUser || state !== 'incoming') return;
    try {
      await simpleUser.decline();
      setState('registered');
      setIncomingCaller('');
    } catch (e) {
      setError(e.message);
    }
  }, [simpleUser, state]);

  const mute = useCallback(() => {
    if (simpleUser) {
      simpleUser.mute();
      setIsMuted(true);
    }
  }, [simpleUser]);

  const unmute = useCallback(() => {
    if (simpleUser) {
      simpleUser.unmute();
      setIsMuted(false);
    }
  }, [simpleUser]);

  const hold = useCallback(async () => {
    if (simpleUser?.hold) {
      try {
        await simpleUser.hold();
        setIsHeld(true);
      } catch (e) {
        setError(e.message);
      }
    }
  }, [simpleUser]);

  const ensureRegistered = useCallback(async () => {
    if (!simpleUser) throw new Error('SIP hazır değil');
    if (state === 'registered' || state === 'connected' || state === 'incoming') return;
    try {
      setState('connecting');
      await simpleUser.connect();
    } catch {}
    await simpleUser.register();
  }, [simpleUser, state]);

  const call = useCallback(
    async (destination) => {
      if (!simpleUser) throw new Error('SIP hazır değil');
      await ensureRegistered();
      const digits = String(destination || '').replace(/\D/g, '');
      if (!digits) throw new Error('Geçersiz hedef numara');
      const target = `sip:${digits}@${SIP_DOMAIN}`;
      try {
        console.log('[SIP] 📤 Giden arama başlatılıyor:', target);
        await simpleUser.call(target);
      } catch (e) {
        const msg = e?.message || String(e);
        setError(msg);
        throw e;
      }
    },
    [simpleUser, ensureRegistered]
  );

  const unhold = useCallback(async () => {
    if (simpleUser?.unhold) {
      try {
        await simpleUser.unhold();
        setIsHeld(false);
      } catch (e) {
        setError(e.message);
      }
    }
  }, [simpleUser]);

  const hangup = useCallback(async () => {
    if (simpleUser) {
      try {
        await simpleUser.hangup();
      } catch (e) {
        setError(e.message);
      }
    }
  }, [simpleUser]);

  const sendDTMF = useCallback(
    async (tone) => {
      if (simpleUser?.sendDTMF) {
        try {
          await simpleUser.sendDTMF(tone);
        } catch (e) {
          setError(e.message);
        }
      }
    },
    [simpleUser]
  );

  const value = {
    enabled: !!hasConfig,
    state,
    incomingCaller,
    error,
    isMuted,
    isHeld,
    answer,
    decline,
    mute,
    unmute,
    hold,
    unhold,
    ensureRegistered,
    call,
    hangup,
    sendDTMF,
    simpleUser,
  };

  return <SipContext.Provider value={value}>{children}</SipContext.Provider>;
}

export function useSip() {
  return useContext(SipContext);
}
