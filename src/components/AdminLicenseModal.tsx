import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, X, Lock, Check, Copy, UserCheck, RefreshCw, Smartphone, MessageCircle, Settings, Power, Upload, Trash2, Image as ImageIcon, Sparkles, Database, Users, Search, Unlock, Download } from 'lucide-react';
import { clearActiveLicense } from '../services/licenseService';
import { SportStatsLogo } from './SportStatsLogo';

interface AdminLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLicenseChanged?: () => void;
  onLogout?: () => void;
}

export interface SupabaseUserItem {
  id: string;
  username: string;
  displayName?: string;
  role: 'admin' | 'client';
  status: 'active' | 'pending' | 'suspended' | 'expired';
  planType: string;
  planLabel: string;
  createdAt: number;
  expiresAt: number | null;
  boundDeviceId?: string | null;
  boundDeviceName?: string | null;
  boundDeviceUpdatedAt?: string | null;
  lastActiveAt?: number | null;
  whatsappNumber?: string | null;
  notes?: string | null;
  daysRemaining?: number | null;
  isExpired?: boolean;
}

interface ServerLicenseItem {
  id: string;
  key: string;
  deviceId: string;
  clientNote?: string;
  clientName?: string;
  planType: string;
  planLabel: string;
  createdAt: number;
  expiresAt: number | null;
  lastActiveTimestamp?: number;
  deviceInfo?: string;
  revoked: boolean;
  isOnline?: boolean;
  daysRemaining?: number | null;
  isExpired?: boolean;
}

export const AdminLicenseModal: React.FC<AdminLicenseModalProps> = ({ isOpen, onClose, onLicenseChanged, onLogout }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'USERS' | 'CONFIG'>('USERS');

  const [appUsersList, setAppUsersList] = useState<SupabaseUserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userFilter, setUserFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'BOUND'>('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [newQuickUsername, setNewQuickUsername] = useState('');
  const [newQuickPin, setNewQuickPin] = useState('');
  const [newQuickName, setNewQuickName] = useState('');
  const [newQuickDays, setNewQuickDays] = useState<number>(30);
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [clientNote, setClientNote] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'24H' | '7D' | '15D' | '30D' | '90D' | 'PERMANENT' | 'CUSTOM'>('30D');
  const [customDate, setCustomDate] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null);
  const [whatsappTemplateText, setWhatsappTemplateText] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedWhatsAppMsg, setCopiedWhatsAppMsg] = useState(false);

  const [licensesList, setLicensesList] = useState<ServerLicenseItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState<'ALL' | 'ONLINE' | 'EXPIRING' | 'EXPIRED' | 'REVOKED'>('ALL');
  const [deviceSearch, setDeviceSearch] = useState('');

  const [adminWhatsApp, setAdminWhatsApp] = useState('573213902708');
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [supabaseAdminThrottleConfigured, setSupabaseAdminThrottleConfigured] = useState(false);
  const [supabaseProject, setSupabaseProject] = useState<string | null>(null);
  const [supabaseSqlSchema, setSupabaseSqlSchema] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/license/config');
      const data = await res.json();
      if (data.success && data.adminWhatsApp) setAdminWhatsApp(data.adminWhatsApp);
      const statusResponse = await fetch('/api/admin/supabase-status');
      if (statusResponse.ok) {
        const sb = await statusResponse.json();
        if (sb.success) {
          setSupabaseConfigured(Boolean(sb.configured));
          setSupabaseAdminThrottleConfigured(Boolean(sb.adminLoginThrottleConfigured));
          setSupabaseProject(sb.supabaseProject || null);
          if (sb.sqlSchema) setSupabaseSqlSchema(sb.sqlSchema);
        }
      }
    } catch {
      setConfigError('No se pudo cargar la configuración del panel.');
    }
  }, []);

  const loadAppUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    const mergedMap = new Map<string, SupabaseUserItem>();
    try {
      const rawLocal = localStorage.getItem('sportstats_local_users_cache');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          for (const u of parsed) {
            if (u && u.username) {
              const safeUser = { ...u };
              delete safeUser.pin;
              delete safeUser.pin_hash;
              delete safeUser.pinHash;
              mergedMap.set(safeUser.username, safeUser);
            }
          }
        }
      }
    } catch {}
    try {
      const res = await fetch('/api/admin/users/list');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        for (const u of data.users) {
          if (u && u.username) {
            const safeUser = { ...u };
            delete safeUser.pin;
            delete safeUser.pin_hash;
            delete safeUser.pinHash;
            mergedMap.set(safeUser.username, safeUser);
          }
        }
      }
    } catch {}
    finally {
      const finalUsers = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAppUsersList(finalUsers);
      try { localStorage.setItem('sportstats_local_users_cache', JSON.stringify(finalUsers)); } catch {}
      setIsLoadingUsers(false);
    }
  }, []);

  const loadLicensesList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch('/api/license/list');
      const data = await res.json();
      if (data.success && Array.isArray(data.licenses)) setLicensesList(data.licenses);
    } catch {} finally { setIsLoadingList(false); }
  }, []);

  const handleCreateOrUpdateQuickUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newQuickUsername.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPin = newQuickPin.trim();
    if (!cleanUser || cleanUser.length < 3) {
      setActionFeedback('El usuario debe tener al menos 3 caracteres.');
      return;
    }
    const existingUser = appUsersList.find((u) => u.username === cleanUser);
    const nowMs = Date.now();
    const expiresAt = newQuickDays === 0 ? null : nowMs + newQuickDays * 24 * 60 * 60 * 1000;
    const planLabel = newQuickDays === 0 ? 'Pase Permanente Vitalicio' : `Pase ${newQuickDays} Días`;
    const userPayload: SupabaseUserItem & { pin?: string } = {
      id: existingUser?.id || `USR-${nowMs.toString(36).toUpperCase()}`,
      username: cleanUser,
      displayName: newQuickName.trim() || (existingUser?.displayName) || undefined,
      ...(cleanPin ? { pin: cleanPin } : {}),
      role: existingUser?.role || 'client',
      status: 'active',
      planType: newQuickDays === 0 ? 'PERMANENT' : `${newQuickDays}D`,
      planLabel,
      createdAt: existingUser?.createdAt || nowMs,
      expiresAt,
      boundDeviceId: existingUser?.boundDeviceId || null,
      boundDeviceName: existingUser?.boundDeviceName || null,
      daysRemaining: newQuickDays === 0 ? null : newQuickDays,
      isExpired: false
    };
    try {
      const res = await fetch('/api/admin/users/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userPayload })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo guardar la cuenta.');
    } catch {
      setActionFeedback('No se pudo guardar la cuenta. Verifica la sesión del administrador y vuelve a intentar.');
      return;
    }
    setNewQuickUsername('');
    setNewQuickPin('');
    setNewQuickName('');
    setActionFeedback(existingUser ? `Cuenta @${cleanUser} renovada y activada con éxito (+${newQuickDays} días).` : `Cuenta @${cleanUser} creada y activada con éxito.`);
    loadAppUsers();
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleResetUserDevice = async (userId: string, username: string) => {
    try {
      const res = await fetch('/api/admin/users/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo desvincular el dispositivo.');
    } catch {
      setActionFeedback('No se pudo desvincular el dispositivo. Verifica la sesión del administrador y vuelve a intentar.');
      return;
    }
    setActionFeedback(`Dispositivo desvinculado con éxito para @${username}. Ya puede registrar su nuevo equipo.`);
    loadAppUsers();
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleRenewUser = async (userId: string, username: string, addDays = 30) => {
    try {
      const res = await fetch('/api/admin/users/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, addDays })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo renovar la cuenta.');
    } catch {
      setActionFeedback('No se pudo renovar la cuenta. Verifica la sesión del administrador y vuelve a intentar.');
      return;
    }
    setActionFeedback(`Suscripción activada y extendida +${addDays} días para @${username}`);
    loadAppUsers();
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string, username?: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch('/api/admin/users/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo cambiar el estado.');
    } catch {
      setActionFeedback('No se pudo cambiar el estado. Verifica la sesión del administrador y vuelve a intentar.');
      return;
    }
    setActionFeedback(newStatus === 'active' ? `Cuenta ${username ? `@${username}` : ''} activada con éxito.` : `Cuenta ${username ? `@${username}` : ''} suspendida.`);
    loadAppUsers();
    setTimeout(() => setActionFeedback(null), 4000);
  };

  useEffect(() => {
    if (isOpen) {
      localStorage.removeItem('sportstats_admin_saved_pin');
      sessionStorage.removeItem('futbolstats_admin_pin');
      localStorage.removeItem('sportstats_admin_remember');
      fetch('/api/admin/session')
        .then(async (res) => {
          if (!res.ok) {
            setIsAdminAuthenticated(false);
            if (res.status === 503) {
              setPinError('Configura ADMIN_PIN, ADMIN_SESSION_SECRET y SUPABASE_SERVICE_ROLE_KEY en Vercel para habilitar el acceso administrativo.');
            }
            return;
          }
          const data = await res.json();
          if (data.authenticated) {
            setIsAdminAuthenticated(true);
            loadAppUsers();
            loadLicensesList();
            loadConfig();
          }
        })
        .catch(() => setPinError('No se pudo verificar la sesión administrativa.'));
    }
  }, [isOpen, loadConfig, loadLicensesList, loadAppUsers]);

  const unlockAdminDeviceAndAuthenticate = () => {
    setIsAdminAuthenticated(true);
    setPinInput('');
    loadAppUsers();
    loadLicensesList();
    loadConfig();
    if (onLicenseChanged) onLicenseChanged();
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const pin = pinInput.trim();
    if (!/^\d{6,}$/.test(pin)) {
      setPinError('Ingresa tu PIN numérico de administrador (mínimo 6 dígitos).');
      return;
    }
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      if (res.ok) {
        unlockAdminDeviceAndAuthenticate();
        return;
      }
      const data = await res.json().catch(() => null);
      setPinError(data?.error || 'Credencial no válida.');
    } catch {
      setPinError('Error de conexión con el servidor.');
    }
  };

  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeviceId.trim()) {
      alert('Por favor ingresa el Código de Dispositivo del cliente (ej. DEV-8B3F-2A9C).');
      return;
    }
    let customExpiryMs: number | undefined;
    if (selectedPlan === 'CUSTOM' && customDate) {
      customExpiryMs = new Date(customDate).getTime();
    }
    try {
      const res = await fetch('/api/license/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: targetDeviceId.trim(), clientNote: clientNote.trim() || undefined, planType: selectedPlan, customExpiryMs })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setGeneratedKey(data.record.key);
          setWhatsappTemplateText(data.whatsappReply);
          const expText = data.record.expiresAt ? new Date(data.record.expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Permanente (Vitalicio)';
          setGeneratedExpiry(expText);
          loadLicensesList();
          return;
        }
      }
    } catch {
      setActionFeedback('No se pudo conectar con el servidor para generar la licencia.');
      return;
    }
    setActionFeedback('El servidor no pudo generar la licencia. No se creó una clave local.');
  };

  const handleCopyGeneratedKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyWhatsAppMsg = () => {
    if (!whatsappTemplateText) return;
    navigator.clipboard.writeText(whatsappTemplateText);
    setCopiedWhatsAppMsg(true);
    setTimeout(() => setCopiedWhatsAppMsg(false), 2000);
  };

  const handleToggleRevoke = async (key: string, currentRevoked: boolean) => {
    try {
      const res = await fetch('/api/license/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, revoke: !currentRevoked })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo actualizar la licencia.');
      loadLicensesList();
      if (onLicenseChanged) onLicenseChanged();
    } catch {
      alert('No se pudo actualizar el estado de la licencia');
    }
  };

  const handle1ClickRenew = async (key: string, addDays: number) => {
    try {
      const res = await fetch('/api/license/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, addDays })
      });
      const data = await res.json();
      if (data.success) {
        loadLicensesList();
        if (onLicenseChanged) onLicenseChanged();
      } else {
        alert('No se pudo renovar la licencia.');
      }
    } catch {
      alert('Error de conexión al renovar la licencia.');
    }
  };

  const handleCloseModal = () => {
    setPinError(null);
    onClose();
  };

  const handleLogoutAdmin = () => {
    fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {});
    try {
      clearActiveLicense();
      localStorage.removeItem('sportstats_admin_remember');
      localStorage.removeItem('sportstats_admin_saved_pin');
      localStorage.removeItem('sportstats_auth_user');
      localStorage.removeItem('sportstats_client_name');
      sessionStorage.removeItem('futbolstats_admin_pin');
      sessionStorage.removeItem('sportstats_exp_alert_dismissed');
    } catch {}
    setIsAdminAuthenticated(false);
    setPinInput('');
    setPinError(null);
    onClose();
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSuccess(null);
    setConfigError(null);
    try {
      const res = await fetch('/api/license/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminWhatsApp: adminWhatsApp.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al guardar configuración.');
      setConfigSuccess('Número de WhatsApp actualizado.');
      setTimeout(() => setConfigSuccess(null), 5000);
    } catch {
      setConfigError('No se pudo guardar la configuración. Verifica tu sesión y vuelve a intentar.');
    }
  };

  if (!isOpen) return null;

  if (!isAdminAuthenticated) {
    return (
      <div onClick={handleCloseModal} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
        <div onClick={(e) => e.stopPropagation()} className="bg-[#0B111E] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center">
          <button onClick={handleCloseModal} type="button" className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer" title="Cerrar">
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center mx-auto mb-3.5">
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="text-base font-bold text-white tracking-tight mb-1">Verificación de Seguridad</h3>
          <p className="text-xs text-slate-400 mb-5">Ingresa el PIN privado de administrador para continuar.</p>
          <form onSubmit={handleVerifyPin} className="space-y-3.5">
            <input type="password" inputMode="numeric" autoComplete="current-password" value={pinInput} onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 32)); setPinError(null); }} placeholder="PIN de administrador" autoFocus className="w-full bg-[#070B14] border border-slate-700/80 rounded-xl px-4 py-2.5 text-center text-lg font-mono tabular-nums tracking-widest text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition" />
            {pinError && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-lg">{pinError}</div>}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button type="button" onClick={handleCloseModal} className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer">Cancelar</button>
              <button type="submit" className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer">Verificar</button>
            </div>
          </form>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">¿Olvidaste el PIN? Restablécelo en las variables de entorno del proyecto en Vercel (`ADMIN_PIN`) y publica un nuevo despliegue. No existe un código maestro dentro de la aplicación.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0C121E] border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[95vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        <div className="p-3 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-black text-white flex items-center gap-2 truncate"><span>Panel de Administración · SportStats Pro</span></h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">Genera licencias, personaliza el logo y gestiona accesos.</p>
            </div>
          </div>
          <button onClick={handleCloseModal} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 ml-2" title="Cerrar y bloquear panel">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap border-b border-slate-800/60 shrink-0">
          <button onClick={() => { setActiveTab('USERS'); loadAppUsers(); }} className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs font-bold ${activeTab === 'USERS' ? 'border-indigo-400 text-indigo-400 bg-indigo-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Usuarios del Sistema ({appUsersList.length})</span>
            <span className="inline sm:hidden">Usuarios ({appUsersList.length})</span>
          </button>
          <button onClick={() => setActiveTab('CONFIG')} className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-1.5 shrink-0 cursor-pointer text-xs font-bold ${activeTab === 'CONFIG' ? 'border-cyan-400 text-cyan-400 bg-cyan-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Seguridad & PIN</span>
          </button>
          <button onClick={handleLogoutAdmin} className="ml-auto my-auto px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0" title="Cerrar sesión por completo y volver a la pantalla de inicio de sesión">
            <Power className="w-3.5 h-3.5 text-rose-400" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {activeTab === 'USERS' && (
              <div className="space-y-4">
                {actionFeedback && (
                  <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-indigo-400" /><span>{actionFeedback}</span></div>
                    <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer">✕</button>
                  </div>
                )}
                <form onSubmit={handleCreateOrUpdateQuickUser} className="bg-[#080D16] p-3.5 rounded-xl border border-indigo-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-indigo-400" /><span>Crear o Activar Usuario Rápido</span></span>
                    <span className="text-[10px] text-slate-400">Activa al instante a cualquier cliente</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <input type="text" value={newQuickUsername} onChange={(e) => setNewQuickUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20))} placeholder="Usuario (ej. carlos99)" required className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400" />
                    <input type="text" value={newQuickPin} onChange={(e) => setNewQuickPin(e.target.value)} placeholder="PIN (opcional, autogenerado si es nuevo)" className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400" />
                    <input type="text" value={newQuickName} onChange={(e) => setNewQuickName(e.target.value)} placeholder="Nombre (opcional)" className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400" />
                    <select value={newQuickDays} onChange={(e) => setNewQuickDays(Number(e.target.value))} className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer">
                      <option value={1}>Prueba 24 Horas</option>
                      <option value={7}>7 Días</option>
                      <option value={15}>15 Días</option>
                      <option value={30}>30 Días (Mensual)</option>
                      <option value={90}>90 Días</option>
                      <option value={0}>Permanente</option>
                    </select>
                    <button type="submit" className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow-sm">+ Activar Usuario</button>
                  </div>
                </form>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#080D16] p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] font-bold">
                    {[
                      { id: 'ALL', label: `Todos (${appUsersList.length})` },
                      { id: 'ACTIVE', label: '🟢 Activos' },
                      { id: 'BOUND', label: '📱 Vinculados' },
                      { id: 'PENDING', label: '⏳ Pendientes' },
                      { id: 'SUSPENDED', label: '🚫 Suspendidos' }
                    ].map((f) => (
                      <button key={f.id} type="button" onClick={() => setUserFilter(f.id as any)} className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer ${userFilter === f.id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>{f.label}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Buscar usuario, nombre, notas o teléfono..." className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 w-full sm:w-64" />
                  </div>
                </div>
                <div className="space-y-2">
                  {appUsersList
                    .filter((u) => {
                      if (userFilter === 'ACTIVE' && u.status !== 'active') return false;
                      if (userFilter === 'BOUND' && !u.boundDeviceId) return false;
                      if (userFilter === 'PENDING' && u.status !== 'pending') return false;
                      if (userFilter === 'SUSPENDED' && u.status !== 'suspended') return false;
                      if (userSearch.trim()) {
                        const q = userSearch.toLowerCase();
                        const userMatch = (u.username || '').toLowerCase().includes(q);
                        const nameMatch = (u.displayName || '').toLowerCase().includes(q);
                        const notesMatch = (u.notes || '').toLowerCase().includes(q);
                        const phoneMatch = (u.whatsappNumber || '').toLowerCase().includes(q);
                        return userMatch || nameMatch || notesMatch || phoneMatch;
                      }
                      return true;
                    })
                    .map((u) => {
                      const isSuspended = u.status === 'suspended';
                      const isExpired = u.isExpired || (u.expiresAt ? u.expiresAt < Date.now() : false);
                      const isBound = !!u.boundDeviceId;
                      const daysLeft = u.daysRemaining;
                      return (
                        <div key={u.id} className={`p-4 rounded-2xl border space-y-3 text-xs transition ${isSuspended ? 'bg-rose-950/10 border-rose-500/30' : isExpired ? 'bg-amber-950/10 border-amber-500/30' : 'bg-[#080D16] border-slate-800'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-sm text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">@{u.username}</span>
                              {u.displayName && <span className="font-bold text-slate-100 text-sm">{u.displayName}</span>}
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">{u.role === 'admin' ? '🛡️ Admin' : '👤 Cliente'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isSuspended ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : isExpired ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : u.status === 'pending' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>{isSuspended ? 'Suspendido' : isExpired ? 'Vencido' : u.status === 'pending' ? 'Pendiente' : 'Activo'}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="bg-[#050810] p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
                              <div className="flex items-center justify-between"><span className="text-[10px] uppercase font-bold text-slate-400">Plan Activo</span><span className="font-bold text-slate-200">{u.planLabel}</span></div>
                              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/40"><span className="text-[10px] uppercase font-bold text-slate-400">Días Restantes</span><span className={`font-mono font-black text-xs ${isSuspended || isExpired ? 'text-rose-400' : daysLeft !== null && daysLeft !== undefined && daysLeft <= 3 ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>{daysLeft === null || daysLeft === undefined ? 'Vitalicio (Sin Fin)' : `${daysLeft} días`}</span></div>
                            </div>
                            <div className="bg-[#050810] p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between">
                              <div className="flex items-center justify-between"><span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><Smartphone className="w-3 h-3 text-cyan-400" /><span>Dispositivo Único</span></span><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBound ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{isBound ? '1 Vinculado' : 'Sin Vincular'}</span></div>
                              <div className="mt-2 pt-1.5 border-t border-slate-800/40 flex items-center justify-between gap-2">{isBound ? (<><div className="min-w-0"><p className="text-[11px] font-mono text-slate-300 truncate font-semibold" title={u.boundDeviceId || ''}>{u.boundDeviceName || u.boundDeviceId}</p><span className="text-[9px] text-slate-500 block truncate">Bloqueado a este equipo</span></div><button type="button" onClick={() => handleResetUserDevice(u.id, u.username)} className="shrink-0 px-2 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition" title="Permitir que el cliente inicie sesión en otro equipo"><Unlock className="w-3 h-3" /><span>Desvincular</span></button></>) : (<span className="text-[10px] text-slate-400">Listo para vincular al iniciar sesión</span>)}</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button type="button" onClick={() => handleRenewUser(u.id, u.username, 1)} className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer flex items-center gap-1" title="Extender 1 día adicional"><span>+1 Día</span></button>
                              <button type="button" onClick={() => handleRenewUser(u.id, u.username, 7)} className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer flex items-center gap-1" title="Extender 7 días adicionales"><span>+7 Días</span></button>
                              <button type="button" onClick={() => handleRenewUser(u.id, u.username, 15)} className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer flex items-center gap-1" title="Extender 15 días adicionales"><span>+15 Días</span></button>
                              <button type="button" onClick={() => handleRenewUser(u.id, u.username, 30)} className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer flex items-center gap-1" title="Extender 30 días adicionales"><span>+30 Días</span></button>
                              <button type="button" onClick={() => handleRenewUser(u.id, u.username, 90)} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition cursor-pointer" title="Extender 90 días"><span>+90 Días</span></button>
                              <button type="button" onClick={() => handleToggleUserStatus(u.id, u.status, u.username)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${isSuspended || u.status === 'pending' ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40'}`}>{u.status === 'pending' ? '✅ Aprobar y Activar' : isSuspended ? 'Reactivar Cuenta' : 'Suspender Acceso'}</button>
                            </div>
                            {u.whatsappNumber && (<a href={`https://wa.me/${u.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${u.displayName || u.username}, tu cuenta de SportStats Pro (@${u.username}) está activa. Puedes ingresar desde cualquier navegador.`)}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition"><MessageCircle className="w-3 h-3" /><span>WhatsApp</span></a>)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            {activeTab === 'CONFIG' && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                  <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5"><Shield className="w-4 h-4 text-amber-400" /><span>Seguridad del administrador</span></h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">El PIN no se muestra ni se guarda en este dispositivo. Para cambiarlo u olvidarlo, actualiza `ADMIN_PIN` en las variables de entorno de Vercel y publica un nuevo despliegue. Usa un PIN privado de 10 o más dígitos; no existe un código maestro de acceso.</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-950/20 via-slate-900/70 to-slate-900/50 border border-teal-500/30 space-y-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs font-black text-teal-300 uppercase tracking-wider flex items-center gap-1.5"><Database className="w-4 h-4 text-teal-400" /><span>Base de Datos en la Nube (Supabase Free)</span></h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${supabaseAdminThrottleConfigured ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-slate-800/50 border border-slate-700 text-slate-400'}`}>{supabaseAdminThrottleConfigured ? 'Límite Activo' : 'Sin Configurar'}</span>
                  </div>
                  {supabaseConfigured ? (
                    <div className="flex items-center justify-between gap-2"><span className="text-[10px] text-slate-400">Proyecto</span><span className="font-mono text-[10px] text-slate-200 truncate max-w-[120px]" title={supabaseProject || ''}>{supabaseProject}</span></div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ejecuta este SQL en tu editor de Supabase</h5>
                      <div className="flex gap-2"><button onClick={() => { navigator.clipboard.writeText(supabaseSqlSchema || ''); setCopiedSql(true); setTimeout(() => setCopiedSql(false), 2000); }} className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer">{copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}<span>{copiedSql ? '¡SQL Copiado!' : 'Copiar Script SQL'}</span></button></div>
                      <p className="text-[10px] text-slate-400">Copia este script y pégalo en el <strong>SQL Editor</strong> de tu proyecto en Supabase para crear las tablas y la función de límite compartido de intentos.</p>
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400 space-y-1 bg-[#070B14] p-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-200 block text-[10px] uppercase tracking-wider mb-1">2. Variables a configurar en tu entorno (.env / Vercel):</span>
                    <div className="font-mono text-[10px] text-teal-300 space-y-0.5"><div>SUPABASE_URL=https://tu-proyecto.supabase.co</div><div>SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key</div></div>
                  </div>
                </div>
                <form onSubmit={handleSaveConfig} className="space-y-5">
                  <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-emerald-400" /><span>Número de WhatsApp para Solicitudes</span></h4>
                    <input type="text" value={adminWhatsApp} onChange={(e) => setAdminWhatsApp(e.target.value)} placeholder="Ej: 573213902708" className="w-full bg-[#080D16] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500 transition" required />
                    <span className="text-[11px] text-slate-500 block">Canal oficial configurado para solicitudes de clientes</span>
                  </div>
                  {configError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold">{configError}</div>}
                  {configSuccess && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /><span>{configSuccess}</span></div>}
                  <button type="submit" className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer">Guardar número de WhatsApp</button>
                </form>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};