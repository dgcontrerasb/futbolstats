import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';
export type ColorPalette = 'emerald' | 'gold' | 'sapphire' | 'crimson';

export interface PaletteConfig {
  id: ColorPalette;
  name: string;
  emoji: string;
  accentHex: string;
  glowHex: string;
  borderHex: string;
  subtleHex: string;
  primaryClass: string;
  gradientClass: string;
  badgeClass: string;
  glowClass: string;
  borderClass: string;
  textAccentClass: string;
}

export const PALETTES: Record<ColorPalette, PaletteConfig> = {
  emerald: {
    id: 'emerald',
    name: 'Cyber Terminal (Neón)',
    emoji: '⚡',
    accentHex: '#00ff66',
    glowHex: 'rgba(0, 255, 102, 0.25)',
    borderHex: 'rgba(0, 255, 102, 0.4)',
    subtleHex: 'rgba(0, 255, 102, 0.1)',
    primaryClass: 'bg-[#00ff66]',
    gradientClass: 'from-[#00ff66] to-[#00b347]',
    badgeClass: 'bg-[#00ff66]/10 border-[#00ff66]/30 text-[#00ff66]',
    glowClass: 'shadow-[#00ff66]/20',
    borderClass: 'border-[#00ff66]/40',
    textAccentClass: 'text-[#00ff66]'
  },
  gold: {
    id: 'gold',
    name: 'Bloomberg Terminal (Oro)',
    emoji: '🪙',
    accentHex: '#f59e0b',
    glowHex: 'rgba(245, 158, 11, 0.25)',
    borderHex: 'rgba(245, 158, 11, 0.4)',
    subtleHex: 'rgba(245, 158, 11, 0.1)',
    primaryClass: 'bg-[#f59e0b]',
    gradientClass: 'from-[#f59e0b] to-[#d97706]',
    badgeClass: 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]',
    glowClass: 'shadow-[#f59e0b]/20',
    borderClass: 'border-[#f59e0b]/40',
    textAccentClass: 'text-[#f59e0b]'
  },
  sapphire: {
    id: 'sapphire',
    name: 'Quantum AI (Zafiro)',
    emoji: '💠',
    accentHex: '#00e5ff',
    glowHex: 'rgba(0, 229, 255, 0.25)',
    borderHex: 'rgba(0, 229, 255, 0.4)',
    subtleHex: 'rgba(0, 229, 255, 0.1)',
    primaryClass: 'bg-[#00e5ff]',
    gradientClass: 'from-[#00e5ff] to-[#0099cc]',
    badgeClass: 'bg-[#00e5ff]/10 border-[#00e5ff]/30 text-[#00e5ff]',
    glowClass: 'shadow-[#00e5ff]/20',
    borderClass: 'border-[#00e5ff]/40',
    textAccentClass: 'text-[#00e5ff]'
  },
  crimson: {
    id: 'crimson',
    name: 'High-Frequency (Carmesí)',
    emoji: '🎯',
    accentHex: '#ff2a5f',
    glowHex: 'rgba(255, 42, 95, 0.25)',
    borderHex: 'rgba(255, 42, 95, 0.4)',
    subtleHex: 'rgba(255, 42, 95, 0.1)',
    primaryClass: 'bg-[#ff2a5f]',
    gradientClass: 'from-[#ff2a5f] to-[#cc0033]',
    badgeClass: 'bg-[#ff2a5f]/10 border-[#ff2a5f]/30 text-[#ff2a5f]',
    glowClass: 'shadow-[#ff2a5f]/20',
    borderClass: 'border-[#ff2a5f]/40',
    textAccentClass: 'text-[#ff2a5f]'
  }
};

interface ThemeContextType {
  theme: ThemeMode;
  palette: ColorPalette;
  paletteConfig: PaletteConfig;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setPalette: (palette: ColorPalette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('sportstats_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // fallback
    }
    return 'dark';
  });

  const [palette, setPaletteState] = useState<ColorPalette>(() => {
    try {
      const saved = localStorage.getItem('sportstats_palette');
      if (saved && saved in PALETTES) return saved as ColorPalette;
    } catch {
      // fallback
    }
    return 'emerald';
  });

  const activeConfig = PALETTES[palette] || PALETTES.emerald;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-palette', palette);
    root.style.setProperty('--accent-cyber', activeConfig.accentHex);
    root.style.setProperty('--accent-cyber-glow', activeConfig.glowHex);
    root.style.setProperty('--accent-cyber-border', activeConfig.borderHex);
    root.style.setProperty('--accent-cyber-subtle', activeConfig.subtleHex);

    document.body.style.backgroundColor = '#0b0e14';
    document.body.style.color = '#8b949e';

    try {
      localStorage.setItem('sportstats_theme', theme);
      localStorage.setItem('sportstats_palette', palette);
    } catch {
      // ignore
    }
  }, [theme, palette, activeConfig]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
  };

  const setPalette = (pal: ColorPalette) => {
    setPaletteState(pal);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        palette,
        paletteConfig: activeConfig,
        toggleTheme,
        setTheme,
        setPalette
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
