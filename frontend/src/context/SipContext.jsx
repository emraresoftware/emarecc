import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Web } from 'sip.js';
import { useAuth } from './AuthContext';

const SipContext = createContext(null);

const WS_URL = import.meta.env.VITE_SIP_WS_URL || (typeof window !== 'undefined' ? `wss://${window.location.host}/ws` : '');
const SIP_DOMAIN = import.meta.env.VITE_SIP_DOMAIN || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
const SIP_SECRET = import.meta.env.VITE_SIP_SECRET || 'webrtc123';

// --- Autoplay Kilidi Açma ---
// Tarayıcılar ses çalmayı kullanıcı etkileşimi olmadan engeller.
// İlk tıklama/dokunuşta AudioContext oluşturup kilidi açıyoruz.
let _audioCtx = null;
let _audioUnlocked = false;
function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtx;
}
function unlockAudio() {
  if (_audioUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    // Sessiz 1ms buffer çal — tarayıcı artık ses çalmayı engellemez
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    _audioUnlocked = true;
    console.log('[SIP] 🔊 Audio context kilidi açıldı');
  } catch (_) {}
}
if (typeof window !== 'undefined') {
  ['click', 'touchstart', 'keydown'].forEach(evt =>
    document.addEventListener(evt, unlockAudio, { once: false, passive: true })
  );
}

// Web Audio API ile bip sesi çalma (autoplay engeline karşı yedek)
let _ringOscillator = null;
let _ringGain = null;
let _ringInterval = null;
function startOscillatorRing() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    _ringGain = ctx.createGain();
    _ringGain.connect(ctx.destination);
    _ringGain.gain.value = 0;

    _ringOscillator = ctx.createOscillator();
    _ringOscillator.type = 'sine';
    _ringOscillator.frequency.value = 800;
    _ringOscillator.connect(_ringGain);
    _ringOscillator.start();

    // 400ms ses, 300ms sessizlik döngüsü
    let on = true;
    _ringGain.gain.value = 0.3;
    _ringInterval = setInterval(() => {
      on = !on;
      _ringGain.gain.value = on ? 0.3 : 0;
    }, on ? 400 : 300);
    console.log('[SIP] 🔔 Oscillator ring başladı');
  } catch (e) {
    console.warn('[SIP] Oscillator ring başlatılamadı:', e);
  }
}
function stopOscillatorRing() {
  try {
    if (_ringInterval) { clearInterval(_ringInterval); _ringInterval = null; }
    if (_ringOscillator) { _ringOscillator.stop(); _ringOscillator.disconnect(); _ringOscillator = null; }
    if (_ringGain) { _ringGain.disconnect(); _ringGain = null; }
  } catch (_) {}
}

export function SipProvider({ children }) {
  const { user } = useAuth();
  const [simpleUser, setSimpleUser] = useState(null);
  const [state, setState] = useState('disconnected'); // disconnected | connecting | registered | incoming | calling | connected
  const [incomingCaller, setIncomingCaller] = useState('');
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const reconnectTimerRef = useRef(null);
  const healthTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectInFlightRef = useRef(false);
  const isAnsweringRef = useRef(false);
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
        constraints: {
          audio: true,
          video: false,
        },
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

          // Kayıt başarılı — mikrofon iznini şimdiden al
          // Böylece "Cevapla" tıklayınca getUserMedia beklemez
          navigator.mediaDevices?.getUserMedia({ audio: true })
            .then((stream) => {
              console.log('[SIP] 🎙️ Mikrofon izni alındı (ön hazırlık)');
              // Stream'i kapat — sadece izin almak içindi
              stream.getTracks().forEach(t => t.stop());
            })
            .catch((e) => console.warn('[SIP] 🎙️ Mikrofon izni alınamadı:', e.message));

          // AudioContext kilidini de aç (kullanıcı login'de etkileşim yapmıştı)
          unlockAudio();
        },
        onUnregistered: () => {
          console.warn('[SIP] ⚠️ Kayıt silindi');
          setState('disconnected');
          clearHealth();
          scheduleReconnect();
        },
        onCallReceived: () => {
          // Eğer zaten connected veya incoming durumdaysak yeni modal AÇMA
          // (Queue re-INVITE veya media re-negotiation bunu tetikleyebilir)
          const currentState = stateRef.current;
          if (currentState === 'connected') {
            console.log('[SIP] ⚠️ onCallReceived geldi ama zaten connected — yoksayılıyor (re-INVITE?)');
            return;
          }
          if (currentState === 'incoming') {
            console.log('[SIP] ⚠️ onCallReceived geldi ama zaten incoming — yoksayılıyor (duplicate?)');
            return;
          }
          // answer() çalışırken Queue retry INVITE'larını yoksay
          if (isAnsweringRef.current) {
            console.log('[SIP] ⚠️ onCallReceived geldi ama answer() devam ediyor — yoksayılıyor');
            return;
          }

          // Arayan numarasını SimpleUser session'dan çıkar
          let caller = 'Bilinmeyen';
          try {
            const session = su.session;
            if (session?.incomingInviteRequest) {
              const from = session.incomingInviteRequest.message?.from;
              caller = from?.uri?.user || from?.displayName || 'Bilinmeyen';
            } else if (session?.remoteIdentity) {
              caller = session.remoteIdentity.uri?.user || session.remoteIdentity.displayName || 'Bilinmeyen';
            }
          } catch (e) {
            console.warn('[SIP] Arayan bilgisi alınamadı:', e);
          }
          console.log('[SIP] 📞 Gelen arama algılandı — arayan:', caller, '(önceki state:', currentState, ')');

          // ★ 180 Ringing gönder — Asterisk kanalını "Ringing" durumuna geçirir
          // Bu olmadan PJSIP/1000 kanalı "Down" kalır ve GoIP16 aramayı CANCEL eder
          try {
            const session = su.session;
            console.log('[SIP] 🔍 Session mevcut:', !!session, 'state:', session?.state, 'progress:', typeof session?.progress);
            if (session && typeof session.progress === 'function') {
              session.progress({ statusCode: 180, reasonPhrase: 'Ringing' })
                .then(() => console.log('[SIP] ✅ 180 Ringing gönderildi (progress resolve)'))
                .catch((e) => {
                  console.warn('[SIP] ⚠️ progress() hata verdi, incomingInviteRequest ile deneniyor:', e.message);
                  // Fallback: düşük seviye API ile 180 gönder
                  try {
                    if (session.incomingInviteRequest && typeof session.incomingInviteRequest.progress === 'function') {
                      session.incomingInviteRequest.progress({ statusCode: 180, reasonPhrase: 'Ringing' });
                      console.log('[SIP] ✅ 180 Ringing gönderildi (incomingInviteRequest fallback)');
                    }
                  } catch (e2) {
                    console.warn('[SIP] ❌ incomingInviteRequest fallback da başarısız:', e2.message);
                  }
                });
            } else if (session?.incomingInviteRequest && typeof session.incomingInviteRequest.progress === 'function') {
              // progress() metodu yoksa doğrudan incomingInviteRequest kullan
              session.incomingInviteRequest.progress({ statusCode: 180, reasonPhrase: 'Ringing' });
              console.log('[SIP] ✅ 180 Ringing gönderildi (incomingInviteRequest direkt)');
            } else {
              console.warn('[SIP] ❌ 180 gönderilemedi — ne progress() ne incomingInviteRequest.progress() mevcut');
            }
          } catch (e) {
            console.warn('[SIP] 180 progress hatası:', e);
          }

          setState('incoming');
          setIncomingCaller(caller || 'Bilinmeyen');

          // Tarayıcı bildirimi
          try {
            if (Notification.permission === 'granted') {
              new Notification('Gelen Arama', { body: caller, icon: '/phone.png', tag: 'incoming-call', requireInteraction: true });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission();
            }
          } catch (_) {}

          // Çalma sesi — önce HTML5 Audio dene, başarısız olursa Web Audio oscillator kullan
          try {
            let ring = document.getElementById('sip-ring-audio');
            if (!ring) {
              ring = document.createElement('audio');
              ring.id = 'sip-ring-audio';
              ring.loop = true;
              ring.src = '/ringtone.wav';
              document.body.appendChild(ring);
            }
            ring.currentTime = 0;
            const playPromise = ring.play();
            if (playPromise && playPromise.catch) {
              playPromise.catch((err) => {
                console.warn('[SIP] 🔇 HTML5 Audio çalınamadı (autoplay engeli?):', err.message);
                // Yedek: Web Audio API oscillator ile bip sesi
                startOscillatorRing();
              });
            }
          } catch (_) {
            // Son çare: oscillator
            startOscillatorRing();
          }
        },
        onCallAnswered: () => {
          console.log('[SIP] 📞 Arama cevaplandı');
          setState('connected');
          setIsMuted(su?.isMuted?.() ?? false);
          setIsHeld(false);
          // Çalma sesini durdur (her iki yöntem)
          try { const r = document.getElementById('sip-ring-audio'); if (r) { r.pause(); r.currentTime = 0; } } catch (_) {}
          stopOscillatorRing();
        },
        onCallHangup: () => {
          console.log('[SIP] 📞 Arama sonlandı');
          setState('registered');
          setIncomingCaller('');
          setIsMuted(false);
          setIsHeld(false);
          // Çalma sesini durdur (her iki yöntem)
          try { const r = document.getElementById('sip-ring-audio'); if (r) { r.pause(); r.currentTime = 0; } } catch (_) {}
          stopOscillatorRing();
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
    if (!simpleUser || state !== 'incoming') {
      console.warn('[SIP] answer() atlandı — state:', state, 'simpleUser:', !!simpleUser);
      return;
    }
    console.log('[SIP] 📞 Cevapla tıklandı — answer() çağrılıyor...');
    console.log('[SIP] 📞 Session durumu:', {
      hasSession: !!simpleUser.session,
      sessionState: simpleUser.session?.state,
    });
    // Guard: answer işlemi sürerken yeni INVITE'ları yoksay
    isAnsweringRef.current = true;
    // Hemen state'i connected yap ki modal tekrar açılmasın
    setState('connected');
    // Çalma seslerini hemen durdur
    try { const r = document.getElementById('sip-ring-audio'); if (r) { r.pause(); r.currentTime = 0; } } catch (_) {}
    stopOscillatorRing();
    try {
      console.log('[SIP] 📞 simpleUser.answer() çağrılıyor...');
      await simpleUser.answer();
      console.log('[SIP] ✅ answer() başarılı — arama cevaplanıyor');
      // Session state kontrolü
      console.log('[SIP] 📞 Answer sonrası session state:', simpleUser.session?.state);
    } catch (e) {
      console.error('[SIP] ❌ answer() hatası:', e?.message || e, e);
      console.error('[SIP] ❌ answer() hata detayı:', {
        name: e?.name,
        message: e?.message,
        stack: e?.stack?.split('\n').slice(0, 3).join(' | '),
      });
      setError(e.message || String(e));
      // Gerçekten başarısız olduysa state'i geri al
      setState('registered');
      setIncomingCaller('');
    } finally {
      // 3sn sonra guard'ı kaldır (Queue retry süresi kadar bekle)
      setTimeout(() => { isAnsweringRef.current = false; }, 3000);
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
    // Gerçek WebSocket bağlantısını kontrol et — React state yalan söyleyebilir
    const wsConnected = typeof simpleUser.isConnected === 'function' ? simpleUser.isConnected() : false;
    const cur = stateRef.current;
    if (wsConnected && (cur === 'registered' || cur === 'connected' || cur === 'incoming')) {
      return; // Gerçekten bağlı ve kayıtlı
    }
    console.log('[SIP] 🔄 ensureRegistered: bağlantı/kayıt gerekli', { cur, wsConnected });
    setState('connecting');
    if (!wsConnected) {
      try { await simpleUser.connect(); } catch (e) {
        console.warn('[SIP] ⚠️ connect hatası:', e?.message);
      }
    }
    await simpleUser.register();
  }, [simpleUser]);

  const call = useCallback(
    async (destination) => {
      if (!simpleUser) throw new Error('SIP hazır değil');
      // Eğer eski bir session takılı kalmışsa önce temizle
      if (simpleUser.session) {
        console.warn('[SIP] ⚠️ Eski session mevcut, önce temizleniyor');
        try { await simpleUser.hangup(); } catch (_) {}
        // onCallHangup'ın state'i sıfırlaması için kısa bekle
        await new Promise(r => setTimeout(r, 200));
      }
      await ensureRegistered();
      const digits = String(destination || '').replace(/\D/g, '');
      if (!digits) throw new Error('Geçersiz hedef numara');
      const target = `sip:${digits}@${SIP_DOMAIN}`;
      try {
        console.log('[SIP] 📤 Giden arama başlatılıyor:', target);
        setState('calling');
        await simpleUser.call(target);
      } catch (e) {
        const msg = e?.message || String(e);
        console.error('[SIP] ❌ Arama başlatılamadı:', msg);
        setState('registered');
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
    const cur = stateRef.current;
    console.log('[SIP] 📞 hangup() çağrıldı, state:', cur, 'session:', simpleUser?.session?.state);
    // Çalma seslerini hemen durdur
    try { const r = document.getElementById('sip-ring-audio'); if (r) { r.pause(); r.currentTime = 0; } } catch (_) {}
    stopOscillatorRing();

    if (!simpleUser) {
      // simpleUser yok — sadece arama state'lerini temizle
      if (cur === 'calling' || cur === 'incoming' || cur === 'connected') {
        console.log('[SIP] 🔄 simpleUser yok, arama state temizleniyor');
        setState('registered');
        setIncomingCaller('');
      }
      return;
    }

    try {
      await simpleUser.hangup();
      // Başarılı → onCallHangup delegate zaten state'i 'registered' yaptı
      console.log('[SIP] ✅ hangup() başarılı');
    } catch (e) {
      console.warn('[SIP] ⚠️ hangup() hatası:', e?.message);
      // onCallHangup çağrılmadı — SADECE arama state'lerini temizle
      // 'disconnected' veya 'connecting' → DOKUNMA! reconnect mekanizması çalışsın
      const curAfter = stateRef.current;
      if (curAfter === 'calling' || curAfter === 'incoming' || curAfter === 'connected') {
        console.log('[SIP] 🔄 hangup hatası sonrası arama state temizleniyor');
        setState('registered');
        setIncomingCaller('');
        setIsMuted(false);
        setIsHeld(false);
      }
    }
  }, [simpleUser]); // NOT: state dependency yok — stateRef kullanıyoruz

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
