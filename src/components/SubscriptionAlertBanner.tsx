import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, MessageCircle, X } from 'lucide-react';

export const SubscriptionAlertBanner: React.FC = () => {
  const [alertInfo, setAlertInfo] = useState<{
    daysLeft: number;
    hoursLeft: number;
    username: string;
    adminWhatsApp: string;
  } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('sportstats_exp_alert_dismissed') === 'true') {
        return;
      }

      const rawUser = localStorage.getItem('sportstats_auth_user');
      if (!rawUser) return;
      const user = JSON.parse(rawUser);

      // Sin notificación para administradores o cuentas vitalicias/permanentes
      if (!user || user.role === 'admin' || user.expiresAt === null || !user.expiresAt) {
        return;
      }

      // EXCLUSIÓN ESTRICTA: Excepto en pruebas de 1 día (24 horas)
      const planType = String(user.planType || '').toUpperCase();
      const planLabel = String(user.planLabel || '').toLowerCase();
      const is24hTrial =
        planType === '24H' ||
        planType === '1D' ||
        planType === '24-HOURS' ||
        planLabel.includes('24 hora') ||
        planLabel.includes('24h') ||
        planLabel.includes('1 día') ||
        planLabel.includes('prueba');

      if (is24hTrial) {
        return;
      }

      const now = Date.now();
      const expiresAt = Number(user.expiresAt);
      const diffMs = expiresAt - now;

      // Solo notificar si faltan 3 días o menos (0 < diffMs <= 3 * 24 * 60 * 60 * 1000)
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (diffMs > 0 && diffMs <= threeDaysMs) {
        const hoursLeft = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let wa = '573213902708';
        try {
          const rawConfig = localStorage.getItem('sportstats_admin_whatsapp');
          if (rawConfig) wa = rawConfig;
        } catch {
          // ignore
        }

        setAlertInfo({
          daysLeft,
          hoursLeft,
          username: user.username || 'usuario',
          adminWhatsApp: wa
        });
      }
    } catch {
      // ignore
    }
  }, []);

  if (!alertInfo || isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('sportstats_exp_alert_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const cleanPhone = alertInfo.adminWhatsApp.replace(/[^0-9]/g, '');
  const renewalMsg = `👋 Hola! Mi suscripción de SportStats Pro (@${alertInfo.username}) vence en ${
    alertInfo.daysLeft === 1 ? '1 día' : `${alertInfo.daysLeft} días`
  }. Me gustaría renovar mi acceso para seguir utilizándolo sin interrupción. ¿Cuáles son los métodos de pago?`;
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(renewalMsg)}`;

  return (
    <div className="w-full bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border-b border-amber-500/40 text-amber-200 px-3 sm:px-6 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs z-30">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
          <AlertTriangle className="w-4 h-4 animate-pulse" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white flex items-center gap-1.5 flex-wrap">
            <span>Aviso de Vencimiento:</span>
            <span className="font-mono text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded text-[11px] border border-amber-500/30 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              {alertInfo.daysLeft === 1
                ? '¡Vence mañana!'
                : `Faltan ${alertInfo.daysLeft} días (${alertInfo.hoursLeft}h)`}
            </span>
          </p>
          <p className="text-[11px] text-amber-300/80 truncate">
            Tu suscripción está próxima a vencer. Renueva a tiempo para no perder las estadísticas en vivo ni las predicciones avanzadas.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer hover:scale-102 active:scale-98"
        >
          <MessageCircle className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">Renovar por WhatsApp</span>
          <span className="inline sm:hidden">Renovar</span>
        </a>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md text-amber-400/70 hover:text-white hover:bg-amber-800/40 transition cursor-pointer"
          title="Ocultar aviso por ahora"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
