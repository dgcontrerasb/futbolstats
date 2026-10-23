import React, { useState } from 'react';

interface SportStatsLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  withGlow?: boolean;
  withText?: boolean;
  subtitle?: string;
  activeSport?: 'SOCCER' | 'NBA';
}

export const SportStatsLogo: React.FC<SportStatsLogoProps> = ({
  className = '',
  size = 'md',
  withGlow = true,
  withText = false,
  subtitle,
  activeSport = 'SOCCER'
}) => {
  const [logoSrc, setLogoSrc] = useState('/logo.png');

  const sizeDimensions = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-8 h-8 sm:w-9 sm:h-9 text-xs',
    md: 'w-10 h-10 sm:w-11 sm:h-11 text-sm',
    lg: 'w-12 h-12 sm:w-14 sm:h-14 text-base',
    xl: 'w-16 h-16 sm:w-20 sm:h-20 text-lg'
  };

  const glowStyles = withGlow
    ? 'shadow-lg shadow-amber-500/25 ring-1 ring-amber-500/40 dark:shadow-amber-500/20'
    : '';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`${sizeDimensions[size]} rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden transition-all duration-300 ${glowStyles} bg-slate-900 border border-amber-500/40`}
      >
        <img
          src={logoSrc}
          alt="SportStats Pro Logo"
          onError={() => {
            if (logoSrc !== '/apple-touch-icon.png') {
              setLogoSrc('/apple-touch-icon.png');
            }
          }}
          className="w-full h-full object-cover rounded-xl"
        />
      </div>

      {withText && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">
              SportStats <span className="text-cyan-500 dark:text-cyan-400">Pro</span>
            </span>
          </div>
          {subtitle && (
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
