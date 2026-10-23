import React from 'react';
import { Calendar, BarChart3, TrendingUp, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type MobileTab = 'MATCHES' | 'FILTERS' | 'PROBABILITY' | 'ADMIN';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  matchesCount: number;
  liveMatchesCount: number;
  onOpenAdmin: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  matchesCount,
  liveMatchesCount,
  onOpenAdmin
}) => {
  const { paletteConfig } = useTheme();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl transition-colors duration-200 bg-[#0b0e14]/92 border-[#30363d] shadow-[0_-8px_24px_rgba(0,0,0,0.4)] pb-[env(safe-area-inset-bottom,8px)]"
      aria-label="Navegación móvil inferior"
    >
      <div className="grid grid-cols-4 items-center h-14 max-w-lg mx-auto px-2">
        {/* Tab 1: Matches */}
        <button
          onClick={() => onTabChange('MATCHES')}
          type="button"
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer relative ${
            activeTab === 'MATCHES'
              ? 'text-white font-bold'
              : 'text-[#8b949e] font-medium hover:text-white'
          }`}
        >
          <div className="relative">
            <Calendar className="w-5 h-5" />
            {liveMatchesCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse leading-none">
                {liveMatchesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Partidos</span>
          {activeTab === 'MATCHES' && (
            <span
              className="absolute bottom-1 w-6 h-0.5 rounded-full"
              style={{ backgroundColor: paletteConfig.accentHex }}
            />
          )}
        </button>

        {/* Tab 2: Filters & Markets */}
        <button
          onClick={() => onTabChange('FILTERS')}
          type="button"
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer relative ${
            activeTab === 'FILTERS'
              ? 'text-white font-bold'
              : 'text-[#8b949e] font-medium hover:text-white'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Filtros & Stats</span>
          {activeTab === 'FILTERS' && (
            <span
              className="absolute bottom-1 w-6 h-0.5 rounded-full"
              style={{ backgroundColor: paletteConfig.accentHex }}
            />
          )}
        </button>

        {/* Tab 3: Value Predictions (+EV) */}
        <button
          onClick={() => onTabChange('PROBABILITY')}
          type="button"
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer relative ${
            activeTab === 'PROBABILITY'
              ? 'text-white font-bold'
              : 'text-[#8b949e] font-medium hover:text-white'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Valor +EV</span>
          {activeTab === 'PROBABILITY' && (
            <span
              className="absolute bottom-1 w-6 h-0.5 rounded-full"
              style={{ backgroundColor: paletteConfig.accentHex }}
            />
          )}
        </button>

        {/* Tab 4: Admin Panel */}
        <button
          onClick={onOpenAdmin}
          type="button"
          className="flex flex-col items-center justify-center h-full min-h-[44px] transition-transform active:scale-95 cursor-pointer text-[#8b949e] hover:text-white"
        >
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] tracking-tight mt-1">Seguridad</span>
        </button>
      </div>
    </nav>
  );
};
