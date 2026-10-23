import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 backdrop-blur-md border border-amber-400/40 px-3.5 py-2 text-xs font-semibold text-white shadow-xl shadow-amber-950/50 animate-in fade-in slide-in-from-bottom-2">
      <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
      <span>Modo Sin Conexión — Usando pronósticos en memoria local</span>
    </div>
  );
};
