import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, MessageCircle, ChevronRight, AlertCircle, Sparkles, Smartphone, ShieldAlert, Check } from 'lucide-react';
import {
  getOrCreateDeviceId,
  saveActiveLicense,
  toLicenseValidationResult,
  LicenseValidationResult
} from '../services/licenseService';
import { SportStatsLogo } from './SportStatsLogo';
import { useTheme } from '../context/ThemeContext';

interface AccessLockScreenProps {
  onUnlock: (result: LicenseValidationResult, key: string) => void;
  onOpenAdmin: () => void;
}

function removeCachedPinFields(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...value };
  delete sanitized.pin;
  delete sanitized.pin_hash;
  delete sanitized.pinHash;
  return sanitized;
}

function clearCachedClientPins(): void {
  try {
    const cachedUsers = localStorage.getItem('sportstats_local_users_cache');
    if (cachedUsers) {
      const parsed = JSON.parse(cachedUsers);
      if (Array.isArray(parsed)) {
        localStorage.setItem(
          'sportstats_local_users_cache',
          JSON.stringify(parsed.map((user) => (
            user && typeof user === 'object' ? removeCachedPinFields(user) : user
          )))
        );
      }
    }

    const cachedUser = localStorage.getItem('sportstats_auth_user');
    if (cachedUser) {
      const parsed = JSON.parse(cachedUser);
      if (parsed && typeof parsed === 'object') {
        localStorage.setItem('sportstats_auth_user', JSON.stringify(removeCachedPinFields(parsed)));
      }
    }
  } catch {
    try {
      localStorage.removeItem('sportstats_local_users_cache');
    } catch {
      // Storage is unavailable in this browser context.
    }
  }
}

export const AccessLockScreen: React.FC<AccessLockScreenProps> = ({ onUnlock, onOpenAdmin }) => {
  const { paletteConfig } = useTheme();
  const [deviceId, setDeviceId] = useState('');
  const [friendlyDeviceName, setFriendlyDeviceName] = useState('');
  
  // Tabs: 'LOGIN' (Usuario + PIN) | 'REGISTER' (Solicitar Nueva Cuenta)
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Form State - Login
  const [usernameInput, setUsernameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [loginError, setLoginError] = useState<{ code?: string; message: string; boundDevice?: string } | null>(null);

  // Form State - Register
  const [regUsername, setRegUsername] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regWhatsAppUrl, setRegWhatsAppUrl] = useState<string | null>(null);

  // Legacy key toggle
  const [showLegacyKey, setShowLegacyKey] = useState(false);
  const [legacyKeyInput, setLegacyKeyInput] = useState('');
  const [legacyError, setLegacyError] = useState<string | null>(null);

  // WhatsApp Config
  const [adminWhatsApp, setAdminWhatsApp] = useState('573213902708');

  // Secret 3-click logo detector for Admin Modal
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSecretLogoClick = () => {
    tapCountRef.current += 1;
    if (tapCountRef.current >= 3) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapCountRef.current = 0;
      onOpenAdmin();
      return;
    }

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1500);
  };

  useEffect(() => {
    clearCachedClientPins();
    const id = getOrCreateDeviceId();
    setDeviceId(id);

    // Detect friendly device name (e.g., "iPhone · Safari" or "Windows PC · Chrome")
    let devName = 'Dispositivo Web';
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      const platform = navigator.platform || '';
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const isAndroid = /Android/i.test(ua);
      const isMac = /Mac/i.test(platform);
      const isWin = /Win/i.test(platform);

      let browser = 'Navegador';
      if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
      else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
      else if (/Firefox/i.test(ua)) browser = 'Firefox';
      else if (/Edg/i.test(ua)) browser = 'Edge';

      if (isIOS) devName = `iPhone · ${browser}`;
      else if (isAndroid) devName = `Android · ${browser}`;
      else if (isMac) devName = `Mac · ${browser}`;
      else if (isWin) devName = `Windows · ${browser}`;
      else devName = `${platform.slice(0, 10)} · ${browser}`;
    }
    setFriendlyDeviceName(devName);

    // Fetch Admin WhatsApp
    fetch('/api/license/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.adminWhatsApp) {
          setAdminWhatsApp(data.adminWhatsApp);
        }
      })
      .catch(() => {
        setAdminWhatsApp('573213902708');
      });
  }, []);

  // Normaliza usuario eliminando espacios y caracteres no permitidos (permite correo para el administrador)
  const handleUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
    setUsernameInput(clean);
    setLoginError(null);
  };

  const handleRegUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    setRegUsername(clean);
    setRegError(null);
    setRegSuccess(null);
    setRegWhatsAppUrl(null);
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanUser = usernameInput.trim();
    const cleanPin = pinInput.trim();

    if (!cleanUser || cleanUser.length < 3) {
      setLoginError({ message: 'Ingresa un usuario válido (3 a 20 caracteres, letras y números).' });
      return;
    }
    if (cleanUser.toLowerCase() === 'admin') {
      setLoginError({ message: 'El administrador debe ingresar desde el panel administrativo.' });
      return;
    }

    if (!cleanPin) {
      setLoginError({ message: 'Ingresa tu PIN de acceso.' });
      return;
    }

    setIsValidating(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          pin: cleanPin,
          deviceId,
          deviceName: friendlyDeviceName
        })
      });

      if (!res.ok) {
        const text = await res.text();
        let errMsg = 'Error en el servidor al autenticar';
        try {
          const parsed = JSON.parse(text);
          if (parsed.message) errMsg = parsed.message;
        } catch {
          // not json
        }
        setLoginError({ message: errMsg });
        return;
      }

      const data = await res.json();

      if (data.success && data.user) {
        if (data.user.role === 'admin') {
          setLoginError({ message: 'El administrador debe ingresar desde el panel administrativo.' });
          return;
        }
        if (typeof data.accountCredential !== 'string') {
          setLoginError({ message: 'El servidor no emitió una credencial segura. Intenta de nuevo.' });
          return;
        }

        const validationRes = await fetch('/api/license/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: data.accountCredential,
            deviceId,
            clientName: data.user.displayName || data.user.username
          })
        });
        const validationData = await validationRes.json();
        const unlockResult = toLicenseValidationResult(validationData, deviceId);
        if (
          !validationRes.ok ||
          !unlockResult ||
          typeof validationData.offlineGrant !== 'string' ||
          typeof validationData.licensePublicKey !== 'string'
        ) {
          setLoginError({
            message: typeof validationData.message === 'string'
              ? validationData.message
              : 'No se pudo confirmar la licencia en el servidor.'
          });
          return;
        }

        const clientName = data.user.displayName || data.user.username;
        localStorage.setItem('sportstats_auth_user', JSON.stringify(data.user));
        localStorage.setItem('sportstats_client_name', clientName);
        saveActiveLicense(
          data.accountCredential,
          unlockResult,
          validationData.offlineGrant,
          validationData.licensePublicKey
        );
        onUnlock(unlockResult, data.accountCredential);
        return;
      } else {
        setLoginError({
          code: data.code,
          message: data.message || 'Credenciales inválidas',
          boundDevice: data.boundDeviceName
        });
      }
    } catch {
      setLoginError({ message: 'Error de conexión con el servidor. Intenta de nuevo.' });
    } finally {
      setIsValidating(false);
    }
  };

  // Submit Register Request
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    setRegWhatsAppUrl(null);

    const cleanUser = regUsername.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPin = regPin.trim();
    const cleanName = regDisplayName.trim();

    if (!cleanUser || cleanUser.length < 3) {
      setRegError('El usuario debe tener entre 3 y 20 caracteres (solo letras y números).');
      return;
    }

    if (!cleanPin || cleanPin.length < 4) {
      setRegError('El PIN debe tener al menos 4 dígitos.');
      return;
    }

    // 1. Preparar URL de WhatsApp inmediatamente
    const cleanPhone = (adminWhatsApp || '573213902708').replace(/[^0-9]/g, '');
    const greetingName = cleanName ? ` Mi nombre es ${cleanName}.` : '';
    const msg = `🔥 *Solicitud de Activación de Cuenta · SportStats Pro*${greetingName}\n\n👤 *Usuario solicitado:* @${cleanUser}\n📱 *Equipo:* ${friendlyDeviceName || deviceId}\n\nHola! Deseo activar mi suscripción a SportStats Pro. ¿Cuáles son los planes y métodos de pago disponibles? Muchas gracias!`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

    setRegLoading(true);

    try {
      // Guardar la solicitud en el servidor antes de abrir WhatsApp.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch('/api/auth/register-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUser,
            pin: cleanPin,
            displayName: cleanName || undefined
          }),
          signal: controller.signal
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          setRegError(data?.message || 'No se pudo guardar la solicitud. Intenta de nuevo.');
          return;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      setRegError('No se pudo conectar con el servidor. Tu solicitud no fue guardada; intenta de nuevo.');
      return;
    } finally {
      setRegLoading(false);
    }

    setRegWhatsAppUrl(waUrl);
    setRegSuccess('¡Solicitud creada con éxito! Se ha preparado tu mensaje de activación para WhatsApp.');

    // 4. Abrir WhatsApp de forma compatible con móviles y navegadores
    try {
      const opened = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.href = waUrl;
      }
    } catch {
      window.location.href = waUrl;
    }
  };

  // Contact Admin for Device Change
  const handleRequestDeviceChange = () => {
    const cleanPhone = adminWhatsApp.replace(/[^0-9]/g, '');
    const userTag = usernameInput ? `@${usernameInput}` : 'mi usuario';
    const msg = `📱 *Solicitud de Desvinculación de Dispositivo · SportStats Pro*\n\nHola Administrador, cambié de dispositivo o borré caché en mi navegador.\n\n👤 *Usuario:* ${userTag}\n📱 *Nuevo equipo:* ${friendlyDeviceName}\n\n¿Podrías por favor desvincular mi equipo anterior para poder ingresar en este nuevo? ¡Muchas gracias!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Existing issued keys remain supported when they are present in the server registry.
  const handleLegacyKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLegacyError(null);
    const clean = legacyKeyInput.trim().toUpperCase();

    if (!clean) return;

    try {
      const res = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: clean, deviceId })
      });

      const data = await res.json();
      const check = toLicenseValidationResult(data, deviceId);
      if (
        res.ok &&
        check &&
        typeof data.offlineGrant === 'string' &&
        typeof data.licensePublicKey === 'string'
      ) {
        saveActiveLicense(clean, check, data.offlineGrant, data.licensePublicKey);
        onUnlock(check, clean);
        return;
      }
      setLegacyError(typeof data.message === 'string' ? data.message : 'La clave ingresada no es válida o ha vencido.');
    } catch {
      setLegacyError('No fue posible validar la clave con el servidor. Conéctate a internet e intenta de nuevo.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#8b949e] flex flex-col justify-between relative overflow-hidden font-sans transition-colors duration-200">
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[400px] bg-[#00ff66]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[400px] bg-blue-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header with Secret 3-Click Admin Entry */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div
          onClick={handleSecretLogoClick}
          className="flex items-center gap-3 cursor-pointer select-none transition-transform active:scale-98"
          title="SportStats Pro - Toca 3 veces para entrar al Panel de Administrador"
        >
          <SportStatsLogo size="md" withGlow={true} />
          <div>
            <span className="font-black text-lg tracking-tight text-white">
              SportStats <span className={paletteConfig.textAccentClass}>Pro</span>
            </span>
            <span className="block text-[10px] uppercase font-bold tracking-widest text-[#8b949e]">
              Analítica Deportiva & Modelos +EV
            </span>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-3 flex-1 flex flex-col justify-center">
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 sm:p-7 shadow-2xl relative space-y-4">
          
          {/* Header Title */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold mb-2 ${paletteConfig.badgeClass}`}>
              <Sparkles className="w-3 h-3" />
              <span>Acceso Exclusivo</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">
              Bienvenido a SportStats Pro
            </h1>
            <p className="text-[#8b949e] text-xs mt-1 leading-relaxed">
              Inicia sesión con tu usuario y PIN, o solicita tu cuenta directamente por WhatsApp.
            </p>
          </div>

          {/* Tab Selector: Iniciar Sesión vs Solicitar Cuenta */}
          <div className="grid grid-cols-2 p-1 bg-[#0b0e14] border border-[#30363d] rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('LOGIN');
                setLoginError(null);
              }}
              className={`py-2 px-3 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'LOGIN'
                  ? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('REGISTER');
                setRegError(null);
                setRegSuccess(null);
              }}
              className={`py-2 px-3 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'REGISTER'
                  ? 'bg-emerald-600 text-white shadow-sm border border-emerald-500/50'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Solicitar Cuenta</span>
            </button>
          </div>

          {/* TAB 1: INICIAR SESIÓN */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5 pt-1">
              {/* Username Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Usuario:</span>
                  <span className="text-[10px] text-slate-500 font-normal">Letras y números (sin espacios)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="ej: carlos99"
                    autoFocus
                    required
                    className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono text-white placeholder-[#6e7681] focus:outline-none focus:border-[#00ff66] transition"
                  />
                </div>
              </div>

              {/* PIN Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  PIN de Acceso:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="••••••"
                    maxLength={10}
                    required
                    className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono text-white tracking-widest placeholder-[#6e7681] focus:outline-none focus:border-[#00ff66] transition"
                  />
                </div>
              </div>

              {/* Error Box with Device Lock Shield Handling */}
              {loginError && (
                <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                  loginError.code === 'DEVICE_LOCKED'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-start gap-2">
                    {loginError.code === 'DEVICE_LOCKED' ? (
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{loginError.message}</span>
                  </div>

                  {/* Single-Device Lock: Direct button to request reset to admin */}
                  {loginError.code === 'DEVICE_LOCKED' && (
                    <button
                      type="button"
                      onClick={handleRequestDeviceChange}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Solicitar Cambio de Equipo por WhatsApp</span>
                    </button>
                  )}
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={isValidating}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verificando Credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar a SportStats Pro</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: SOLICITAR CUENTA NUEVA */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Usuario que deseas:</span>
                  <span className="text-[10px] text-slate-500">Solo letras y números</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => handleRegUsernameChange(e.target.value)}
                    placeholder="ej: betmaster"
                    required
                    className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono text-white placeholder-[#6e7681] focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Tu Nombre o Alias (Opcional):
                </label>
                <input
                  type="text"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="ej: Juan Pérez"
                  className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6e7681] focus:outline-none focus:border-emerald-400 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Elige tu PIN personal:</span>
                  <span className="text-[10px] text-slate-500">Mínimo 4 dígitos</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value)}
                    placeholder="Mínimo 4 dígitos"
                    maxLength={10}
                    required
                    className="w-full bg-[#0b0e14] border border-[#30363d] rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono text-white tracking-widest placeholder-[#6e7681] focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>
              </div>

              {regError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2.5 font-bold">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{regSuccess}</span>
                  </div>
                  {regWhatsAppUrl && (
                    <a
                      href={regWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition shadow-md"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Abrir WhatsApp y Enviar al Administrador</span>
                    </a>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white transition active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{regLoading ? 'Procesando solicitud...' : 'Solicitar Activación por WhatsApp'}</span>
              </button>
            </form>
          )}

          {/* Device & Security Footnote */}
          <div className="pt-2 border-t border-[#30363d] flex items-center justify-between text-[11px] text-[#6e7681]">
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>{friendlyDeviceName}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-emerald-400/90">
              Dispositivo Seguro 1/1
            </span>
          </div>

          {/* Legacy Key Fallback Accordion */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setShowLegacyKey(!showLegacyKey)}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition underline underline-offset-2 cursor-pointer"
            >
              {showLegacyKey ? 'Ocultar canje de clave antigua' : '¿Tienes una clave de activación antigua? Ingrésala aquí'}
            </button>

            {showLegacyKey && (
              <form onSubmit={handleLegacyKeySubmit} className="mt-2.5 space-y-2">
                <input
                  type="text"
                  value={legacyKeyInput}
                  onChange={(e) => setLegacyKeyInput(e.target.value)}
                  placeholder="FS-30D-..."
                  className="w-full bg-[#0b0e14] border border-[#30363d] rounded-lg px-3 py-2 text-xs font-mono uppercase text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
                {legacyError && <div className="text-[11px] text-rose-400">{legacyError}</div>}
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-white text-xs font-bold transition cursor-pointer"
                >
                  Validar Clave Antigua
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-center text-[11px] text-[#6e7681] gap-2">
        <p>SportStats Pro · Sistema de Acceso Exclusivo & Protección de Cuenta</p>
      </footer>
    </div>
  );
};
