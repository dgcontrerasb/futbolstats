import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MatchFixture, MatchAnalysis, ActiveSport, NBAMatchFixture, NBAAnalysis } from './types';
import { fetchUpcomingFixtures, getColombiaDateString, syncLivePulseFixtures } from './services/apiService';
import { calculateMatchAnalysis, clearAnalysisCacheForFixture } from './services/mathEngine';
import { fetchNBAFixtures } from './services/nbaApiService';
import { calculateNBAAnalysis } from './services/nbaEngine';
import {
  exportToExcel,
  exportToPDF,
  ExportItem,
  exportNBAToExcel,
  exportNBAToPDF,
  NBAExportItem
} from './services/exportService';
import { FriendlyPredictionCard } from './components/FriendlyPredictionCard';
import { CompetitionBlock } from './components/CompetitionBlock';
import { NBAPredictionCard } from './components/NBAPredictionCard';
import { SimulatorModal } from './components/SimulatorModal';
import { WallpaperSelectorModal } from './components/WallpaperSelectorModal';
import { DidacticGuideModal } from './components/DidacticGuideModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AccessLockScreen } from './components/AccessLockScreen';
import { AdminLicenseModal } from './components/AdminLicenseModal';
import { SubscriptionAlertBanner } from './components/SubscriptionAlertBanner';
import { SportStatsLogo } from './components/SportStatsLogo';
import { MobileBottomNav, MobileTab } from './components/MobileBottomNav';
import { useTheme } from './context/ThemeContext';
import { getSoccerDidacticAdvice, getNBADidacticAdvice } from './services/didacticService';
import { groupFixturesByCompetition, matchesLeagueSelection } from './services/leagueCategorizer';
import {
  getActiveStoredLicense,
  getOrCreateDeviceId,
  verifyOfflineLicenseGrant,
  saveActiveLicense,
  toLicenseValidationResult,
  clearActiveLicense,
  LicenseValidationResult
} from './services/licenseService';
import {
  Search,
  Calendar,
  Trophy,
  Sliders,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Square,
  Clock,
  Filter,
  Layers,
  X,
  Zap,
  BookOpen,
  Sparkles,
  HelpCircle,
  Image as ImageIcon,
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  MoreHorizontal,
  Power
} from 'lucide-react';

function clearLegacyAdminAccess(): boolean {
  try {
    const rawUser = localStorage.getItem('sportstats_auth_user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    const hasLegacyAdminAuth = user?.role === 'admin' || localStorage.getItem('sportstats_admin_remember') === 'true';

    if (rawUser && user && typeof user === 'object') {
      delete user.pin;
      delete user.pin_hash;
      delete user.pinHash;
      localStorage.setItem('sportstats_auth_user', JSON.stringify(user));
    }

    const rawCachedUsers = localStorage.getItem('sportstats_local_users_cache');
    if (rawCachedUsers) {
      const cachedUsers = JSON.parse(rawCachedUsers);
      if (Array.isArray(cachedUsers)) {
        localStorage.setItem('sportstats_local_users_cache', JSON.stringify(cachedUsers.map((cachedUser) => {
          if (!cachedUser || typeof cachedUser !== 'object') return cachedUser;
          const sanitized = { ...cachedUser };
          delete sanitized.pin;
          delete sanitized.pin_hash;
          delete sanitized.pinHash;
          return sanitized;
        })));
      }
    }

    if (hasLegacyAdminAuth) {
      clearActiveLicense();
      localStorage.removeItem('sportstats_auth_user');
      localStorage.removeItem('sportstats_admin_remember');
      localStorage.removeItem('sportstats_admin_saved_pin');
      sessionStorage.removeItem('futbolstats_admin_pin');
    }
    return hasLegacyAdminAuth;
  } catch {
    return false;
  }
}

async function restoreCustomerLicense(
  key: string,
  offlineGrant: string | undefined,
  licensePublicKey: string | undefined,
  deviceId: string
): Promise<LicenseValidationResult | null> {
  try {
    const res = await fetch('/api/license/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        deviceId,
        clientName: localStorage.getItem('sportstats_client_name') || undefined
      })
    });

    if (res.ok) {
      const data = await res.json();
      const result = toLicenseValidationResult(data, deviceId);
      if (
        !result ||
        typeof data.offlineGrant !== 'string' ||
        typeof data.licensePublicKey !== 'string'
      ) {
        return null;
      }
      saveActiveLicense(key, result, data.offlineGrant, data.licensePublicKey);
      return result;
    }
    if (res.status !== 503) return null;
  } catch {
    // A signed offline grant can keep a previously authorized session alive temporarily.
  }

  if (!offlineGrant || !licensePublicKey) return null;
  return verifyOfflineLicenseGrant(offlineGrant, licensePublicKey, deviceId);
}

export default function App() {
  // License & Access Control State
  const [isAppUnlocked, setIsAppUnlocked] = useState(false);
  const [activeLicenseInfo, setActiveLicenseInfo] = useState<LicenseValidationResult | null>(null);
  const [isAdminSessionActive, setIsAdminSessionActive] = useState(false);
  const [adminSessionExpiresAt, setAdminSessionExpiresAt] = useState<number | null>(null);

  const { paletteConfig, theme } = useTheme();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileTab>('MATCHES');

  const handleLogoutSession = useCallback(() => {
    fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {});
    try {
      clearActiveLicense();
      localStorage.removeItem('sportstats_admin_remember');
      localStorage.removeItem('sportstats_admin_saved_pin');
      localStorage.removeItem('sportstats_auth_user');
      localStorage.removeItem('sportstats_client_name');
      sessionStorage.removeItem('futbolstats_admin_pin');
      sessionStorage.removeItem('sportstats_exp_alert_dismissed');
    } catch {
      // ignore storage errors
    }
    setIsAdminModalOpen(false);
    setIsMobileMoreOpen(false);
    setActiveLicenseInfo(null);
    setIsAppUnlocked(false);
    setIsAdminSessionActive(false);
    setAdminSessionExpiresAt(null);
    window.location.reload();
  }, []);

  // Active sport switcher: Soccer vs NBA
  const [activeSport, setActiveSport] = useState<ActiveSport>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_active_sport');
      return saved === 'NBA' || saved === 'SOCCER' ? (saved as ActiveSport) : 'SOCCER';
    } catch {
      return 'SOCCER';
    }
  });

  const handleSelectSport = (sport: ActiveSport) => {
    setActiveSport(sport);
    setSelectedFixtureIds(new Set());
    try {
      localStorage.setItem('futbolstats_active_sport', sport);
    } catch {
      // ignore
    }
  };

  const [currentDate, setCurrentDate] = useState<string>(getColombiaDateString(0));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fixtures, setFixtures] = useState<MatchFixture[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fixtureLoadError, setFixtureLoadError] = useState<string | null>(null);

  // Selection for downloads
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<Set<string>>(new Set());

  // Dropdown states
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Mobile More Actions Dropdown
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const mobileMoreRef = useRef<HTMLDivElement>(null);

  // Secret 3-click logo detector for Admin Panel
  const secretAdminTapCountRef = useRef(0);
  const secretAdminTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSecretAdminLogoClick = () => {
    if (isAdminSessionActive) {
      setIsAdminModalOpen(true);
      return;
    }

    secretAdminTapCountRef.current += 1;
    if (secretAdminTapCountRef.current >= 3) {
      if (secretAdminTapTimerRef.current) clearTimeout(secretAdminTapTimerRef.current);
      secretAdminTapCountRef.current = 0;
      setIsAdminModalOpen(true);
      return;
    }
    if (secretAdminTapTimerRef.current) clearTimeout(secretAdminTapTimerRef.current);
    secretAdminTapTimerRef.current = setTimeout(() => {
      secretAdminTapCountRef.current = 0;
    }, 1500);
  };

  // Filters
  const [selectedFilter, setSelectedFilter] = useState<
    'ALL' | 'RECOMMENDED' | 'CORNERS_SAFE' | 'CARDS_SAFE' | 'DOUBLE_CHANCE' | 'FAVORITES' | 'HIGH_GOALS' | 'BALANCED'
  >('ALL');
  const [selectedLeague, setSelectedLeague] = useState<string>('ALL');

  // Collapsible competition blocks state (Set of group keys that are collapsed)
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());

  // Mobile Lightweight Mode state (auto-detects mobile screens, can be toggled by user)
  const [isLightweightMode, setIsLightweightMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_lightweight_mode');
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' && window.innerWidth < 768;
    } catch {
      return false;
    }
  });

  const handleToggleLightweightMode = useCallback(() => {
    setIsLightweightMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('futbolstats_lightweight_mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Progressive batch rendering count (default 30 matches, loads more on demand)
  const [visibleMatchLimit, setVisibleMatchLimit] = useState<number>(30);

  // Periodic License Validation (Check revocation on server & expiration)
  useEffect(() => {
    const checkLicenseStatus = async () => {
      if (clearLegacyAdminAccess()) return;
      try {
        const adminRes = await fetch('/api/admin/session');
        if (adminRes.ok) {
          const session = await adminRes.json();
          if (session.authenticated) {
            setIsAdminSessionActive(true);
            setAdminSessionExpiresAt(session.expiresAt || null);
            setIsAppUnlocked(true);
            setActiveLicenseInfo({
              isValid: true,
              status: 'ACTIVE',
              message: 'Sesión de administrador activa',
              isPermanent: true,
              isExpired: false,
              expiryTimestamp: null,
              expiryDateFormatted: 'Sesión segura',
              daysRemaining: null,
              targetDeviceId: getOrCreateDeviceId(),
              planLabel: 'Acceso de administrador',
              clientName: 'Administrador'
            });
            return;
          }
        }
      } catch {
        // Continue with the customer's license check.
      }

      setIsAdminSessionActive(false);
      setAdminSessionExpiresAt(null);
      const active = getActiveStoredLicense();
      const devId = getOrCreateDeviceId();
      if (!active) {
        setIsAppUnlocked(false);
        setActiveLicenseInfo(null);
        return;
      }

      const check = await restoreCustomerLicense(
        active.key,
        active.offlineGrant,
        active.licensePublicKey,
        devId
      );
      if (!check) {
        clearActiveLicense();
        setIsAppUnlocked(false);
        setActiveLicenseInfo(null);
        return;
      }
      setIsAppUnlocked(check.isValid);
      setActiveLicenseInfo(check);
    };

    checkLicenseStatus();
  }, []);

  useEffect(() => {
    if (!isAdminSessionActive) return;

    const verifyAdminSession = async () => {
      try {
        const res = await fetch('/api/admin/session');
        if (res.ok) {
          const session = await res.json();
          if (session.authenticated) {
            setAdminSessionExpiresAt(session.expiresAt || null);
            return;
          }
        }
      } catch {
        // A failed check closes the admin-only application session.
      }

      setIsAdminSessionActive(false);
      setAdminSessionExpiresAt(null);
      clearActiveLicense();
      setIsAppUnlocked(false);
      setActiveLicenseInfo(null);
      setIsAdminModalOpen(false);
    };

    const timer = setInterval(verifyAdminSession, 60_000);
    const expiryTimer = adminSessionExpiresAt
      ? setTimeout(verifyAdminSession, Math.max(0, adminSessionExpiresAt - Date.now()))
      : null;
    return () => {
      clearInterval(timer);
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [isAdminSessionActive, adminSessionExpiresAt]);

  // Silent Heartbeat Ping (presencia en tiempo real)
  useEffect(() => {
    if (!isAppUnlocked || isAdminSessionActive) return;

    const sendHeartbeat = async () => {
      const active = getActiveStoredLicense();
      if (!active) {
        clearActiveLicense();
        setIsAppUnlocked(false);
        setActiveLicenseInfo(null);
        return;
      }
      const devId = getOrCreateDeviceId();

      const keepOfflineSession = async () => {
        if (!active.offlineGrant || !active.licensePublicKey) return false;
        const offlineCheck = await verifyOfflineLicenseGrant(
          active.offlineGrant,
          active.licensePublicKey,
          devId
        );
        if (!offlineCheck) return false;
        setActiveLicenseInfo(offlineCheck);
        return true;
      };

      try {
        const clientName = localStorage.getItem('sportstats_client_name') || undefined;
        const deviceInfo = typeof navigator !== 'undefined' ? `${navigator.platform || ''} (${navigator.userAgent.slice(0, 40)})` : undefined;

        const res = await fetch('/api/license/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: active?.key,
            deviceId: devId,
            clientName,
            deviceInfo
          })
        });

        if (res.ok) {
          const data = await res.json();
          const check = toLicenseValidationResult(data, devId);
          if (
            !check ||
            typeof data.offlineGrant !== 'string' ||
            typeof data.licensePublicKey !== 'string'
          ) {
            clearActiveLicense();
            setIsAppUnlocked(false);
            setActiveLicenseInfo(null);
            return;
          }
          saveActiveLicense(active.key, check, data.offlineGrant, data.licensePublicKey);
          setActiveLicenseInfo(check);
          return;
        }
        if (res.status !== 503 || !(await keepOfflineSession())) {
          clearActiveLicense();
          setIsAppUnlocked(false);
          setActiveLicenseInfo(null);
        }
      } catch {
        if (!(await keepOfflineSession())) {
          clearActiveLicense();
          setIsAppUnlocked(false);
          setActiveLicenseInfo(null);
        }
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [isAppUnlocked, isAdminSessionActive]);

  // Reset pagination limit when any filter or date changes
  useEffect(() => {
    setVisibleMatchLimit(30);
  }, [currentDate, selectedLeague, selectedFilter, searchQuery]);

  // NBA Specific States & Filters
  const [nbaFixtures, setNbaFixtures] = useState<NBAMatchFixture[]>([]);
  const [isNBALoading, setIsNBALoading] = useState<boolean>(false);
  const [nbaSearchQuery, setNbaSearchQuery] = useState<string>('');
  const [selectedNBAConference, setSelectedNBAConference] = useState<'ALL' | 'Este' | 'Oeste'>('ALL');
  const [selectedNBAFilter, setSelectedNBAFilter] = useState<'ALL' | 'RECOMMENDED' | 'LIVE' | 'FAVORITES' | 'HIGH_POINTS' | 'HIGH_3PM'>('ALL');

  // Dual View Mode: Simple (Principiante / Didáctico) vs Expert (Analista / Pro)
  const [viewMode, setViewMode] = useState<'SIMPLE' | 'EXPERT'>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_view_mode');
      return saved === 'EXPERT' ? 'EXPERT' : 'SIMPLE';
    } catch {
      return 'SIMPLE';
    }
  });

  const handleToggleViewMode = (mode: 'SIMPLE' | 'EXPERT') => {
    setViewMode(mode);
    try {
      localStorage.setItem('futbolstats_view_mode', mode);
    } catch {
      // ignore
    }
  };

  // Beginner Didactic Guide Modal state
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Modals
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [selectedMatchForSimulator, setSelectedMatchForSimulator] = useState<MatchFixture | null>(null);

  // Wallpaper state (defaults to CR7wallpaper.jpg or user's stored selection)
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>(() => {
    return localStorage.getItem('futbolstats_selected_wallpaper') || '/CR7wallpaper.jpg';
  });
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_wallpaper_opacity');
      return saved ? parseFloat(saved) : 0.65;
    } catch {
      return 0.65;
    }
  });
  const [wallpaperBlur, setWallpaperBlur] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('futbolstats_wallpaper_blur');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState<boolean>(false);
  const [refreshCooldown, setRefreshCooldown] = useState<number>(0);
  const [quotaInfo, setQuotaInfo] = useState<{ remaining: number; shieldActive: boolean } | null>(null);

  // Cooldown timer to prevent user spamming the API refresh button
  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshCooldown]);

  // Query server quota shield status on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.remainingCalls === 'number') {
          setQuotaInfo({
            remaining: data.remainingCalls,
            shieldActive: Boolean(data.quotaShieldActive)
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectWallpaper = (url: string) => {
    setSelectedWallpaper(url);
    try {
      localStorage.setItem('futbolstats_selected_wallpaper', url);
    } catch {
      // ignore quota
    }
  };

  const handleUpdateOpacity = useCallback((val: number) => {
    setWallpaperOpacity(val);
    try {
      localStorage.setItem('futbolstats_wallpaper_opacity', val.toString());
    } catch {
      // ignore quota
    }
  }, []);

  const handleUpdateBlur = useCallback((val: number) => {
    setWallpaperBlur(val);
    try {
      localStorage.setItem('futbolstats_wallpaper_blur', val.toString());
    } catch {
      // ignore quota
    }
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(event.target as Node)) {
        setIsMobileMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load active matches (Scheduled + In-Play)
  const loadMatches = useCallback(async (dateStr: string, forceRefresh = false) => {
    setIsLoading(true);
    try {
      const result = await fetchUpcomingFixtures(dateStr, { forceRefresh });
      setFixtureLoadError(result.error || null);
      if (typeof result.remainingCalls === 'number') {
        setQuotaInfo({
          remaining: result.remainingCalls,
          shieldActive: Boolean(result.quotaShieldActive)
        });
      }
      const activeFixtures = result.fixtures.filter((f) => {
        const idStr = String(f.id);
        if (idStr === '991001' || idStr === '991002' || idStr === '991003') return false;
        return f.status === 'SCHEDULED' || f.status === 'IN_PLAY';
      });
      setFixtures(activeFixtures);
      setSelectedFixtureIds(new Set());
    } catch (err) {
      console.error('Error al cargar pronósticos de partidos:', err);
      setFixtureLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clean legacy cache keys and synthetic test fixtures once on mount to ensure real live API data is loaded
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach((k) => {
        if (
          k.startsWith('futbolstats_upcoming_') ||
          k.startsWith('basketstats_nba_') ||
          k.startsWith('futbolstats_fixtures_')
        ) {
          const val = localStorage.getItem(k);
          if (
            !val ||
            val.includes('991001') ||
            val.includes('991002') ||
            val.includes('991003') ||
            val.includes('Llaneros') ||
            val.includes('Alianza FC') ||
            val.includes('futbolstats_upcoming_v2_') ||
            val.includes('futbolstats_upcoming_v3_')
          ) {
            localStorage.removeItem(k);
          }
        }
      });
    } catch {
      // ignore
    }
  }, []);

  // Only trigger network load on date change, NOT on every keystroke!
  useEffect(() => {
    loadMatches(currentDate, false);
  }, [currentDate, loadMatches]);

  // 45-Second Hybrid Live Update Engine (0 extra API-Football quota consumed)
  const [lastLivePulseAt, setLastLivePulseAt] = useState<string>('');
  const [isPulsingLive, setIsPulsingLive] = useState<boolean>(false);

  const runLivePulseCheck = useCallback(async () => {
    if (activeSport === 'SOCCER' && fixtures.length > 0) {
      setIsPulsingLive(true);
      try {
        const pulseRes = await syncLivePulseFixtures(currentDate, fixtures);
        if (pulseRes.changedIds.length > 0) {
          pulseRes.changedIds.forEach((id) => clearAnalysisCacheForFixture(id));
          setFixtures(pulseRes.updatedFixtures);
        }
        const nowStr = new Date().toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        setLastLivePulseAt(nowStr);
      } finally {
        setIsPulsingLive(false);
      }
    } else if (activeSport === 'NBA' && nbaFixtures.some((f) => f.status === 'IN_PLAY')) {
      setIsPulsingLive(true);
      try {
        const res = await fetchNBAFixtures(currentDate, { forceRefresh: true });
        setNbaFixtures(res.fixtures);
        const nowStr = new Date().toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        setLastLivePulseAt(nowStr);
      } finally {
        setIsPulsingLive(false);
      }
    }
  }, [activeSport, currentDate, fixtures, nbaFixtures]);

  useEffect(() => {
    const interval = setInterval(() => {
      runLivePulseCheck();
    }, 45000);
    return () => clearInterval(interval);
  }, [runLivePulseCheck]);

  // Compute analyses for all upcoming matches
  const analysesMap: Record<string, MatchAnalysis> = useMemo(() => {
    const map: Record<string, MatchAnalysis> = {};
    fixtures.forEach((fix) => {
      map[fix.id] = calculateMatchAnalysis(fix);
    });
    return map;
  }, [fixtures]);

  // Filter based on search query, leagues and simple patterns completely in client memory
  const filteredFixtures = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return fixtures.filter((f) => {
      // 1. Instant client-side search (0 API queries, 0 network requests!)
      if (q) {
        const homeName = f.homeTeam.name.toLowerCase();
        const awayName = f.awayTeam.name.toLowerCase();
        const leagueName = f.league.name.toLowerCase();
        const starHome = (f.homeTeam.starPlayer?.name || '').toLowerCase();
        const starAway = (f.awayTeam.starPlayer?.name || '').toLowerCase();

        const matches =
          homeName.includes(q) ||
          awayName.includes(q) ||
          leagueName.includes(q) ||
          starHome.includes(q) ||
          starAway.includes(q);

        if (!matches) return false;
      }

      const a = analysesMap[f.id];

      // League filter (dynamically supports international tournaments, country groups and single leagues)
      if (selectedLeague !== 'ALL') {
        if (!matchesLeagueSelection(f, selectedLeague)) {
          return false;
        }
      }

      // Pattern filter
      if (a) {
        if (selectedFilter === 'RECOMMENDED') {
          const advice = getSoccerDidacticAdvice(f, a);
          if (advice.signal !== 'GREEN') return false;
        } else if (selectedFilter === 'CORNERS_SAFE') {
          if (a.cornersMarket.recommendedProb < 68) return false;
        } else if (selectedFilter === 'CARDS_SAFE') {
          if (a.refereeCards.recommendedCardProb < 68) return false;
        } else if (selectedFilter === 'DOUBLE_CHANCE') {
          if (
            a.goalsMarket.over15 < 70 &&
            a.goalsMarket.doubleChance1X < 72 &&
            a.goalsMarket.doubleChanceX2 < 72
          ) {
            return false;
          }
        } else if (selectedFilter === 'FAVORITES') {
          if (a.dixonColes.pHomeWin < 52 && a.dixonColes.pAwayWin < 50) return false;
        } else if (selectedFilter === 'HIGH_GOALS') {
          if (a.goalsMarket.over25 < 52) return false;
        } else if (selectedFilter === 'BALANCED') {
          if (Math.abs(a.dixonColes.pHomeWin - a.dixonColes.pAwayWin) > 14) return false;
        }
      }

      return true;
    });
  }, [fixtures, analysesMap, selectedLeague, selectedFilter, searchQuery]);

  // Available competition groups for dropdown selector (derived from all day's fixtures)
  const availableCompetitionGroups = useMemo(() => {
    return groupFixturesByCompetition(fixtures);
  }, [fixtures]);

  // Human-readable title for currently active league or tournament filter
  const activeLeagueLabel = useMemo(() => {
    if (!selectedLeague || selectedLeague === 'ALL') return '';
    if (selectedLeague === 'GROUP_INTL' || selectedLeague === 'INTL') return 'Torneos Internacionales';
    if (selectedLeague.startsWith('LEAGUE_')) {
      const target = selectedLeague.replace('LEAGUE_', '').trim();
      for (const group of availableCompetitionGroups) {
        const found = group.leagues.find(
          (l) => String(l.id).trim() === target || l.name.toLowerCase() === target.toLowerCase()
        );
        if (found) return found.name;
      }
      return target;
    }
    if (selectedLeague.startsWith('COUNTRY_')) {
      const countryKey = selectedLeague.replace('COUNTRY_', '').trim();
      const group = availableCompetitionGroups.find(
        (g) => g.key === countryKey || g.name.toUpperCase() === countryKey
      );
      if (group) return group.name;
      return countryKey;
    }
    return selectedLeague;
  }, [selectedLeague, availableCompetitionGroups]);

  // Progressive slicing: when viewing a specific league, always show all its matches (usually <= 20).
  // When viewing ALL leagues (potentially 200+ matches), slice to visibleMatchLimit for snappy mobile performance.
  const displayFixtures = useMemo(() => {
    if (selectedLeague !== 'ALL' || filteredFixtures.length <= visibleMatchLimit) {
      return filteredFixtures;
    }
    return filteredFixtures.slice(0, visibleMatchLimit);
  }, [filteredFixtures, selectedLeague, visibleMatchLimit]);

  // Group displayed fixtures into collapsible competition blocks
  const groupedFilteredFixtures = useMemo(() => {
    return groupFixturesByCompetition(displayFixtures);
  }, [displayFixtures]);

  const handleToggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const handleToggleAllGroupsCollapse = useCallback(() => {
    const allKeys = groupedFilteredFixtures.map((g) => g.key);
    const allCollapsed = allKeys.length > 0 && allKeys.every((k) => collapsedGroupKeys.has(k));
    if (allCollapsed) {
      setCollapsedGroupKeys(new Set());
    } else {
      setCollapsedGroupKeys(new Set(allKeys));
    }
  }, [groupedFilteredFixtures, collapsedGroupKeys]);

  const handleToggleSelectGroupFixtures = useCallback((fixtureIds: string[], selectAll: boolean) => {
    setSelectedFixtureIds((prev) => {
      const next = new Set(prev);
      if (selectAll) {
        fixtureIds.forEach((id) => next.add(id));
      } else {
        fixtureIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  }, []);

  // NBA Match Loader
  const loadNBAMatches = useCallback(async (dateStr: string, forceRefresh = false) => {
    setIsNBALoading(true);
    try {
      const res = await fetchNBAFixtures(dateStr, { forceRefresh });
      setNbaFixtures(res.fixtures);
    } catch (err) {
      console.error('Error al cargar partidos de NBA:', err);
    } finally {
      setIsNBALoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSport === 'NBA') {
      loadNBAMatches(currentDate, false);
    }
  }, [activeSport, currentDate, loadNBAMatches]);

  // Compute NBA analyses map
  const nbaAnalysesMap: Record<string, NBAAnalysis> = useMemo(() => {
    const map: Record<string, NBAAnalysis> = {};
    nbaFixtures.forEach((f) => {
      map[f.id] = calculateNBAAnalysis(f);
    });
    return map;
  }, [nbaFixtures]);

  // Filtered NBA fixtures
  const filteredNBAFixtures = useMemo(() => {
    const q = nbaSearchQuery.toLowerCase().trim();
    return nbaFixtures.filter((f) => {
      if (q) {
        const h = f.homeTeam.name.toLowerCase();
        const a = f.awayTeam.name.toLowerCase();
        const hShort = f.homeTeam.shortName.toLowerCase();
        const aShort = f.awayTeam.shortName.toLowerCase();
        const cityH = f.homeTeam.city.toLowerCase();
        const cityA = f.awayTeam.city.toLowerCase();
        const starH = (f.homeTeam.keyPlayers?.[0]?.name || '').toLowerCase();
        const starA = (f.awayTeam.keyPlayers?.[0]?.name || '').toLowerCase();

        if (
          !h.includes(q) &&
          !a.includes(q) &&
          !hShort.includes(q) &&
          !aShort.includes(q) &&
          !cityH.includes(q) &&
          !cityA.includes(q) &&
          !starH.includes(q) &&
          !starA.includes(q)
        ) {
          return false;
        }
      }
      if (selectedNBAConference !== 'ALL') {
        if (f.homeTeam.conference !== selectedNBAConference && f.awayTeam.conference !== selectedNBAConference) {
          return false;
        }
      }
      if (selectedNBAFilter === 'LIVE' && f.status !== 'IN_PLAY') {
        return false;
      }
      const analysis = nbaAnalysesMap[f.id];
      if (analysis) {
        if (selectedNBAFilter === 'RECOMMENDED') {
          const advice = getNBADidacticAdvice(f, analysis);
          if (advice.signal !== 'GREEN') return false;
        }
        if (selectedNBAFilter === 'FAVORITES' && analysis.pHomeWin < 60 && analysis.pAwayWin < 60) {
          return false;
        }
        if (selectedNBAFilter === 'HIGH_POINTS' && analysis.projectedTotalPoints < 225) {
          return false;
        }
        if (selectedNBAFilter === 'HIGH_3PM' && (!analysis.threePointersMarket || analysis.threePointersMarket.projectedTotal3PM < 26)) {
          return false;
        }
      }
      return true;
    });
  }, [nbaFixtures, nbaSearchQuery, selectedNBAConference, selectedNBAFilter, nbaAnalysesMap]);

  // Toggle selection for a single fixture (memoized with useCallback)
  const handleToggleSelect = useCallback((fixtureId: string) => {
    setSelectedFixtureIds((prev) => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
      }
      return next;
    });
  }, []);

  // Open simulator modal (memoized with useCallback)
  const handleOpenSimulator = useCallback((fixture: MatchFixture) => {
    setSelectedMatchForSimulator(fixture);
    setIsSimulatorOpen(true);
  }, []);

  // Select all currently visible fixtures (Soccer or NBA)
  const handleSelectAll = () => {
    const currentList = activeSport === 'NBA' ? filteredNBAFixtures : filteredFixtures;
    if (selectedFixtureIds.size === currentList.length && currentList.length > 0) {
      setSelectedFixtureIds(new Set());
    } else {
      setSelectedFixtureIds(new Set(currentList.map((f) => f.id)));
    }
  };

  // Set of fixture IDs currently expanded for full analytics (default: empty for compact scroll)
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const handleToggleCardExpand = useCallback((fixtureId: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
      }
      return next;
    });
  }, []);

  const handleToggleExpandAll = useCallback(() => {
    const currentList = activeSport === 'NBA' ? filteredNBAFixtures : filteredFixtures;
    const currentIds = currentList.map((f) => f.id);
    const allExpanded = currentIds.length > 0 && currentIds.every((id) => expandedCardIds.has(id));

    if (allExpanded) {
      setExpandedCardIds((prev) => {
        const next = new Set(prev);
        currentIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setExpandedCardIds((prev) => {
        const next = new Set(prev);
        currentIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [activeSport, filteredNBAFixtures, filteredFixtures, expandedCardIds]);

  // Prepare soccer items for export
  const getItemsForExport = (onlySelected = false): ExportItem[] => {
    let targets = filteredFixtures;
    if (onlySelected && selectedFixtureIds.size > 0) {
      targets = filteredFixtures.filter((f) => selectedFixtureIds.has(f.id));
    }
    return targets
      .map((f) => ({ fixture: f, analysis: analysesMap[f.id] }))
      .filter((item): item is ExportItem => Boolean(item.analysis));
  };

  // Prepare NBA items for export
  const getNBAItemsForExport = (onlySelected = false): NBAExportItem[] => {
    let targets = filteredNBAFixtures;
    if (onlySelected && selectedFixtureIds.size > 0) {
      targets = filteredNBAFixtures.filter((f) => selectedFixtureIds.has(f.id));
    }
    return targets
      .map((f) => ({ fixture: f, analysis: nbaAnalysesMap[f.id] }))
      .filter((item): item is NBAExportItem => Boolean(item.analysis));
  };

  // Download handlers
  const handleDownloadExcel = (onlySelected = false) => {
    if (activeSport === 'NBA') {
      const items = getNBAItemsForExport(onlySelected);
      if (items.length === 0) return;
      exportNBAToExcel(items, onlySelected ? 'Pronosticos_NBA_Seleccion' : 'Pronosticos_NBA');
    } else {
      const items = getItemsForExport(onlySelected);
      if (items.length === 0) return;
      exportToExcel(items, onlySelected ? 'Pronosticos_Seleccion' : 'Pronosticos_Futbol');
    }
    setIsDownloadMenuOpen(false);
  };

  const handleDownloadPDF = (onlySelected = false) => {
    if (activeSport === 'NBA') {
      const items = getNBAItemsForExport(onlySelected);
      if (items.length === 0) return;
      const title = onlySelected
        ? `Selección de ${items.length} Partidos NBA`
        : `Partidos NBA (${currentDate})`;
      exportNBAToPDF(items, title);
    } else {
      const items = getItemsForExport(onlySelected);
      if (items.length === 0) return;
      const title = onlySelected
        ? `Selección de ${items.length} Partidos Próximos`
        : `Partidos Próximos (${currentDate})`;
      exportToPDF(items, title);
    }
    setIsDownloadMenuOpen(false);
  };

  const hasSelection = selectedFixtureIds.size > 0;
  const currentTotalVisible = activeSport === 'NBA' ? filteredNBAFixtures.length : filteredFixtures.length;

  return (
    <>
      {!isAppUnlocked ? (
        <AccessLockScreen
          onUnlock={(result) => {
            setIsAppUnlocked(true);
            setActiveLicenseInfo(result);
          }}
          onOpenAdmin={() => setIsAdminModalOpen(true)}
        />
      ) : (
        <div
          className="min-h-screen cr7-cinematic-bg text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black pb-20 md:pb-6 transition-colors duration-200"
          style={{
            ['--wallpaper-bg' as string]: `url("${encodeURI(selectedWallpaper)}")`,
            ['--wallpaper-opacity' as string]: `${theme === 'light' ? Math.min(wallpaperOpacity, 0.2) : wallpaperOpacity}`,
            ['--wallpaper-blur' as string]: `${wallpaperBlur}px`
          } as React.CSSProperties}
        >
          {/* 0. Subscription Expiration Alert Banner (3 days warning, excludes 24h trials) */}
          <SubscriptionAlertBanner />

          {/* 1. Header: Editorial Deportivo & Menú de Descarga (Glassmorphic) */}
          <header className="border-b border-[#30363d] bg-[#0b0e14]/90 backdrop-blur-xl sticky top-0 z-40 shadow-xl w-full transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
              
              {/* Columna Izquierda: Logo + Título + Selectores en una sola línea */}
              <div className="flex items-center gap-3.5 flex-wrap sm:flex-nowrap min-w-0">
                <div
                  onClick={handleSecretAdminLogoClick}
                  className="flex items-center gap-2.5 cursor-pointer select-none active:scale-95 transition-transform shrink-0"
                  title="SportStats Pro - Toca 3 veces para entrar al Panel Admin"
                >
                  <SportStatsLogo size="sm" activeSport={activeSport} withGlow={true} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-base font-black tracking-tight text-white uppercase truncate">
                        SportStats <span className={paletteConfig.textAccentClass}>Pro</span>
                        {activeSport === 'NBA' && (
                          <span className="ml-1.5 text-xs font-extrabold text-amber-400">· NBA</span>
                        )}
                      </h1>
                      <span className="text-[10px] font-mono font-semibold text-amber-400 tracking-wide flex items-center gap-1 shrink-0 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                        <Clock className="w-2.5 h-2.5 text-amber-400" /> HORA COL
                      </span>
                    </div>
                    <p className="hidden xl:block text-[11px] text-[#8b949e] truncate">
                      {activeSport === 'NBA'
                        ? 'Modelos Adaptativos en Vivo, Cuartos & Props con Poisson'
                        : 'Pronósticos & Estadísticas de Partidos por Jugar'}
                    </p>
                  </div>
                </div>

                {/* Selector Fútbol / NBA */}
                <div className="flex items-center p-0.5 rounded-lg bg-[#161b22] border border-[#30363d] shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectSport('SOCCER')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      activeSport === 'SOCCER'
                        ? 'bg-[#21262d] text-white border border-[#30363d] shadow-sm'
                        : 'text-[#8b949e] hover:text-white'
                    }`}
                  >
                    <span>⚽</span>
                    <span>Fútbol</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSport('NBA')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      activeSport === 'NBA'
                        ? 'bg-[#21262d] text-white border border-[#30363d] shadow-sm'
                        : 'text-[#8b949e] hover:text-white'
                    }`}
                  >
                    <span>🏀</span>
                    <span>NBA</span>
                  </button>
                </div>

                {/* Selector Modo Fácil / Pro */}
                <div className="flex items-center p-0.5 rounded-lg bg-[#161b22] border border-[#30363d] shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleViewMode('SIMPLE')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'SIMPLE'
                        ? 'bg-[#21262d] text-emerald-400 border border-[#30363d] shadow-sm'
                        : 'text-[#8b949e] hover:text-white'
                    }`}
                    title="Modo Fácil: Para principiantes. Semáforos y explicaciones claras"
                  >
                    <span>🌱</span>
                    <span>Fácil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleViewMode('EXPERT')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'EXPERT'
                        ? 'bg-[#21262d] text-amber-400 border border-[#30363d] shadow-sm'
                        : 'text-[#8b949e] hover:text-white'
                    }`}
                    title="Modo Pro: Para analistas. Matrices, xG y Dixon-Coles"
                  >
                    <span>⚡</span>
                    <span>Pro</span>
                  </button>
                </div>
              </div>

              {/* Columna Derecha: Barra de Acciones y Herramientas */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {isAdminSessionActive && (
                  <button
                    type="button"
                    onClick={() => setIsAdminModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer shadow-sm"
                    title="Abrir Panel de Administrador"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Panel Admin</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] text-xs font-medium transition cursor-pointer"
                  title="¿Cómo funciona?"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">¿Cómo funciona?</span>
                </button>

                <PWAInstallButton />

                <button
                  type="button"
                  onClick={() => {
                    if (refreshCooldown > 0) return;
                    setRefreshCooldown(30);
                    if (activeSport === 'NBA') loadNBAMatches(currentDate, true);
                    else loadMatches(currentDate, true);
                  }}
                  disabled={(activeSport === 'NBA' ? isNBALoading : isLoading) || refreshCooldown > 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-xs font-medium text-white transition border border-[#30363d] cursor-pointer disabled:opacity-50"
                  title="Actualizar partidos y pronósticos en vivo"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      activeSport === 'NBA' ? 'text-amber-400' : 'text-[#00ff66]'
                    } ${(activeSport === 'NBA' ? isNBALoading : isLoading) ? 'animate-spin' : ''}`}
                  />
                  <span className="hidden sm:inline">{refreshCooldown > 0 ? `(${refreshCooldown}s)` : 'Actualizar'}</span>
                </button>

                {/* Dropdown Descargar */}
                <div className="relative" ref={downloadMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                    disabled={currentTotalVisible === 0}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition shadow-sm cursor-pointer ${
                      activeSport === 'NBA' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    <span>Descargar</span>
                    {hasSelection && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-emerald-800">
                        {selectedFixtureIds.size}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isDownloadMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-64 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                      <div className="p-2 border-b border-[#30363d] text-[11px] font-bold text-slate-300">
                        Exportar Pronósticos
                      </div>
                      <div className="p-1.5 space-y-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadExcel(hasSelection)}
                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[#21262d] text-xs text-white flex items-center gap-2 cursor-pointer transition"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Exportar a Excel (.csv)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(hasSelection)}
                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[#21262d] text-xs text-white flex items-center gap-2 cursor-pointer transition"
                        >
                          <FileText className="w-3.5 h-3.5 text-rose-400" />
                          <span>Exportar a PDF (.pdf)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsWallpaperModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] text-xs font-medium transition cursor-pointer"
                  title="Personalizar fondo de pantalla"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#00ff66]" />
                  <span className="hidden md:inline">Fondo</span>
                </button>

                {activeSport === 'SOCCER' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMatchForSimulator(filteredFixtures[0] || null);
                      setIsSimulatorOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-xs font-medium text-white transition border border-[#30363d] cursor-pointer"
                    title="Simulador de partidos personalizados"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#00ff66]" />
                    <span className="hidden md:inline">Simulador</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogoutSession}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
                  title="Cerrar sesión"
                >
                  <Power className="w-3.5 h-3.5 text-rose-400" />
                  <span>Salir</span>
                </button>
              </div>

            </div>
          </header>

          {/* 2. Unified Search & Filters Panel */}
          {activeSport === 'SOCCER' ? (
            <>
              <section className="bg-[#0b0e14] border-b border-[#30363d] py-3.5 px-3 sm:px-6 relative z-10">
                <div className="max-w-4xl mx-auto space-y-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#00ff66] pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar un partido próximo (ej. River Plate, Real Madrid, Arsenal, Boca...)"
                      className="w-full bg-[#161b22] border border-[#30363d] hover:border-[#8b949e]/50 focus:border-[#00ff66] rounded-md py-2 pl-9 pr-8 text-xs sm:text-sm text-white placeholder-[#6e7681] shadow-inner focus:outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white p-1 text-xs rounded-full cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                    <div className="bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#00ff66] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <label className="text-[9px] text-[#8b949e] block uppercase font-mono font-bold tracking-wider">Fecha</label>
                        <select
                          value={
                            currentDate === getColombiaDateString(0)
                              ? 'TODAY'
                              : currentDate === getColombiaDateString(1)
                              ? 'TOMORROW'
                              : currentDate === getColombiaDateString(2)
                              ? 'DAY_AFTER'
                              : 'CUSTOM'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'TODAY') setCurrentDate(getColombiaDateString(0));
                            else if (val === 'TOMORROW') setCurrentDate(getColombiaDateString(1));
                            else if (val === 'DAY_AFTER') setCurrentDate(getColombiaDateString(2));
                          }}
                          className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none w-full cursor-pointer"
                        >
                          <option value="TODAY" className="bg-[#161b22] text-white">Hoy (Colombia)</option>
                          <option value="TOMORROW" className="bg-[#161b22] text-white">Mañana</option>
                          <option value="DAY_AFTER" className="bg-[#161b22] text-white">En 2 Días</option>
                          <option value="CUSTOM" className="bg-[#161b22] text-white">Fecha: {currentDate}</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-[#00ff66] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <label className="text-[9px] text-[#8b949e] block uppercase font-mono font-bold tracking-wider">Mercado</label>
                        <select
                          value={selectedFilter}
                          onChange={(e) => setSelectedFilter(e.target.value as any)}
                          className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none w-full cursor-pointer"
                        >
                          <option value="ALL" className="bg-[#161b22] text-white">Todos los partidos</option>
                          <option value="RECOMMENDED" className="bg-[#161b22] text-[#00ff66] font-bold">🟢 Jugadas Seguras (≥68%)</option>
                          <option value="CORNERS_SAFE" className="bg-[#161b22] text-amber-300 font-semibold">🚩 Córners (+7.5 / +8.5)</option>
                          <option value="CARDS_SAFE" className="bg-[#161b22] text-yellow-300 font-semibold">🟨 Tarjetas (+3.5 / +4.5)</option>
                          <option value="DOUBLE_CHANCE" className="bg-[#161b22] text-blue-300 font-semibold">🛡️ Doble Oportunidad</option>
                          <option value="FAVORITES" className="bg-[#161b22] text-white">⭐ Favorito (&gt;52%)</option>
                          <option value="HIGH_GOALS" className="bg-[#161b22] text-white">⚽ +2.5 Goles</option>
                          <option value="BALANCED" className="bg-[#161b22] text-white">⚖️ Parejos</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-[#161b22] border border-[#30363d] rounded-md px-2.5 py-1.5 flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-[#00ff66] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <label className="text-[9px] text-[#8b949e] block uppercase font-mono font-bold tracking-wider">Competición</label>
                        <select
                          value={selectedLeague}
                          onChange={(e) => setSelectedLeague(e.target.value)}
                          className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none w-full cursor-pointer truncate"
                        >
                          <option value="ALL" className="bg-[#161b22] text-white">
                            🌐 Todas ({fixtures.length} partidos)
                          </option>
                          {availableCompetitionGroups
                            .filter((g) => g.category === 'INTERNATIONAL')
                            .map((intlGroup) => (
                              <optgroup
                                key={intlGroup.key}
                                label={`🏆 ${intlGroup.name} (${intlGroup.totalMatches})`}
                                className="bg-[#0b1220] text-amber-300 font-bold"
                              >
                                <option value="GROUP_INTL" className="bg-[#0b1220] text-white font-semibold">
                                  🏆 Ver todos los torneos internacionales ({intlGroup.totalMatches})
                                </option>
                                {intlGroup.leagues.map((l) => (
                                  <option key={String(l.id)} value={`LEAGUE_${l.id}`} className="bg-[#0b1220] text-slate-200 font-normal">
                                    ⭐ {l.name} ({l.matchCount})
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          {availableCompetitionGroups
                            .filter((g) => g.category === 'COUNTRY')
                            .map((countryGroup) => (
                              <optgroup
                                key={countryGroup.key}
                                label={`${countryGroup.flag} ${countryGroup.name} (${countryGroup.totalMatches})`}
                                className="bg-[#0b1220] text-emerald-300 font-bold"
                              >
                                <option value={`COUNTRY_${countryGroup.key}`} className="bg-[#0b1220] text-white font-semibold">
                                  {countryGroup.flag} Toda {countryGroup.name} ({countryGroup.totalMatches})
                                </option>
                                {countryGroup.leagues.map((l) => (
                                  <option key={String(l.id)} value={`LEAGUE_${l.id}`} className="bg-[#0b1220] text-slate-200 font-normal">
                                    ⚽ {l.name} ({l.matchCount})
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          {availableCompetitionGroups
                            .filter((g) => g.category === 'OTHER')
                            .map((otherGroup) => (
                              <optgroup
                                key={otherGroup.key}
                                label={`⚽ ${otherGroup.name} (${otherGroup.totalMatches})`}
                                className="bg-[#0b1220] text-slate-400 font-bold"
                              >
                                <option value={`COUNTRY_${otherGroup.key}`} className="bg-[#0b1220] text-white font-semibold">
                                  ⚽ Ver otras competiciones ({otherGroup.totalMatches})
                                </option>
                                {otherGroup.leagues.map((l) => (
                                  <option key={String(l.id)} value={`LEAGUE_${l.id}`} className="bg-[#0b1220] text-slate-200 font-normal">
                                    ⚽ {l.name} ({l.matchCount})
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Main Content: Upcoming Matches List */}
              <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4 relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-semibold text-white">
                      {isLoading ? 'Buscando partidos...' : `${filteredFixtures.length} partidos`}
                    </span>
                    {!isLoading && groupedFilteredFixtures.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium text-[11px] border border-slate-700">
                        {groupedFilteredFixtures.length} {groupedFilteredFixtures.length === 1 ? 'competición' : 'competiciones'}
                      </span>
                    )}
                    {hasSelection && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black font-bold">
                        {selectedFixtureIds.size} seleccionados
                      </span>
                    )}
                    {filteredFixtures.some((f) => f.status === 'IN_PLAY') && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[10px] animate-pulse">
                        🔴 En Vivo
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={runLivePulseCheck}
                      disabled={isPulsingLive}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono tabular-nums font-semibold transition-colors cursor-pointer"
                      title="Motor Híbrido En Vivo: sincroniza goles y minutos cada 45 segundos"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${isPulsingLive ? 'animate-ping' : 'animate-pulse'}`}></span>
                      <span>
                        {isPulsingLive
                          ? 'Sincronizando en vivo...'
                          : lastLivePulseAt
                          ? `Pulso 45s (${lastLivePulseAt})`
                          : 'Pulso En Vivo 45s Activo'}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {groupedFilteredFixtures.length > 1 && (
                      <button
                        onClick={handleToggleAllGroupsCollapse}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer text-xs"
                      >
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">
                          {groupedFilteredFixtures.every((g) => collapsedGroupKeys.has(g.key)) ? 'Desplegar ligas' : 'Colapsar ligas'}
                        </span>
                      </button>
                    )}

                    {filteredFixtures.length > 0 && (
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
                      >
                        {selectedFixtureIds.size === filteredFixtures.length ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Deseleccionar todos</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                            <span>Seleccionar todos</span>
                          </>
                        )}
                      </button>
                    )}

                    {filteredFixtures.length > 0 && (
                      <button
                        onClick={handleToggleExpandAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
                      >
                        {filteredFixtures.every((f) => expandedCardIds.has(f.id)) ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden sm:inline">Colapsar detalles</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            <span className="hidden sm:inline">Desplegar detalles</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={handleToggleLightweightMode}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${
                        isLightweightMode
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <Zap className={`w-3.5 h-3.5 ${isLightweightMode ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="hidden xs:inline">
                        {isLightweightMode ? 'Modo Rápido' : 'Modo Liviano'}
                      </span>
                    </button>

                    <button
                      onClick={() => loadMatches(currentDate, true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors border border-slate-700 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
                      <span className="hidden sm:inline">Actualizar</span>
                    </button>
                  </div>
                </div>

                {selectedLeague !== 'ALL' && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Filter className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        Mostrando exclusivamente: <strong className="text-white font-bold">{activeLeagueLabel}</strong> ({filteredFixtures.length} {filteredFixtures.length === 1 ? 'partido' : 'partidos'})
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedLeague('ALL')}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ver todas las ligas</span>
                    </button>
                  </div>
                )}

                {isLoading && (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-slate-300 font-medium">
                      Consultando partidos pendientes y calculando pronósticos...
                    </p>
                  </div>
                )}

                {!isLoading && filteredFixtures.length === 0 && (
                  <div className="py-14 px-6 text-center bg-[#101726]/90 border border-slate-800 rounded-2xl space-y-4 max-w-lg mx-auto backdrop-blur-md">
                    <div className="w-12 h-12 rounded-full bg-slate-800/80 text-emerald-400 flex items-center justify-center mx-auto">
                      <Search className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {fixtures.length > 0
                          ? 'Sin partidos para el filtro actual'
                          : fixtureLoadError
                          ? 'No se pudieron cargar los partidos'
                          : 'No hay partidos programados para esta fecha'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        {fixtures.length > 0
                          ? `No encontramos encuentros con el filtro actual, pero hoy hay ${fixtures.length} partidos reales activos en otras ligas del calendario.`
                          : fixtureLoadError
                          ? `${fixtureLoadError} No mostraremos partidos de respaldo ficticios como si fueran datos reales.`
                          : `Para la fecha seleccionada (${currentDate}) no quedan partidos pendientes verificados. Puedes explorar los partidos de mañana o días cercanos.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {fixtureLoadError && (
                        <button
                          onClick={() => loadMatches(currentDate, true)}
                          disabled={isLoading}
                          className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                          Reintentar conexión
                        </button>
                      )}
                      {fixtures.length > 0 && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedFilter('ALL');
                            setSelectedLeague('ALL');
                          }}
                          className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                          Ver todos los partidos de hoy ({fixtures.length})
                        </button>
                      )}
                      <button
                        onClick={() => setCurrentDate(getColombiaDateString(1))}
                        className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer border border-slate-700"
                      >
                        Ver Partidos de Mañana
                      </button>
                      <button
                        onClick={() => setCurrentDate(getColombiaDateString(-1))}
                        className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer border border-slate-700"
                      >
                        Ver Partidos de Ayer
                      </button>
                    </div>
                  </div>
                )}

                {!isLoading && filteredFixtures.length > 0 && (
                  <div className="space-y-4">
                    {groupedFilteredFixtures.map((group) => (
                      <CompetitionBlock
                        key={group.key}
                        group={group}
                        analysesMap={analysesMap}
                        selectedFixtureIds={selectedFixtureIds}
                        expandedCardIds={expandedCardIds}
                        isGroupCollapsed={
                          selectedLeague !== 'ALL' || groupedFilteredFixtures.length === 1
                            ? false
                            : collapsedGroupKeys.has(group.key)
                        }
                        viewMode={viewMode}
                        isLightweightMode={isLightweightMode}
                        onToggleGroupCollapse={handleToggleGroupCollapse}
                        onToggleSelectFixture={handleToggleSelect}
                        onToggleSelectGroupFixtures={handleToggleSelectGroupFixtures}
                        onOpenSimulator={handleOpenSimulator}
                        onToggleCardExpand={handleToggleCardExpand}
                      />
                    ))}

                    {filteredFixtures.length > displayFixtures.length && (
                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-3 shadow-lg">
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
                          <Zap className="w-4 h-4 text-amber-400" />
                          <span>
                            Mostrando <strong>{displayFixtures.length}</strong> de <strong>{filteredFixtures.length}</strong> partidos de hoy
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                          Carga progresiva activada para garantizar navegación rápida, fluida y sin sobrecalentamiento en celulares.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            onClick={() => setVisibleMatchLimit((prev) => prev + 30)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5"
                          >
                            <span>Cargar 30 partidos más (+30)</span>
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setVisibleMatchLimit(filteredFixtures.length)}
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                          >
                            Cargar todos ({filteredFixtures.length})
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </main>
            </>
          ) : (
            /* NBA Production Workspace */
            <>
              <section className="bg-slate-950/20 backdrop-blur-md border-b border-white/10 py-6 px-4 sm:px-6 relative z-10">
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                    <input
                      type="text"
                      value={nbaSearchQuery}
                      onChange={(e) => setNbaSearchQuery(e.target.value)}
                      placeholder="Buscar franquicia o estrella NBA (ej. Celtics, Lakers, Curry, Dončić, Nuggets...)"
                      className="w-full bg-slate-950/40 backdrop-blur-md border border-white/20 hover:border-white/30 focus:border-amber-400 rounded-2xl py-3 pl-12 pr-10 text-sm sm:text-base text-white placeholder-slate-400 shadow-xl focus:outline-none transition-all"
                    />
                    {nbaSearchQuery && (
                      <button
                        onClick={() => setNbaSearchQuery('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 text-sm rounded-full cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="bg-slate-950/40 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Fecha</label>
                        <select
                          value={
                            currentDate === getColombiaDateString(0)
                              ? 'TODAY'
                              : currentDate === getColombiaDateString(1)
                              ? 'TOMORROW'
                              : currentDate === getColombiaDateString(-1)
                              ? 'YESTERDAY'
                              : 'CUSTOM'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'TODAY') setCurrentDate(getColombiaDateString(0));
                            else if (val === 'TOMORROW') setCurrentDate(getColombiaDateString(1));
                            else if (val === 'YESTERDAY') setCurrentDate(getColombiaDateString(-1));
                          }}
                          className="bg-transparent text-xs font-semibold text-white focus:outline-none w-full cursor-pointer"
                        >
                          <option value="TODAY" className="bg-[#0b1220] text-white">Hoy (Jornada NBA en Directo)</option>
                          <option value="TOMORROW" className="bg-[#0b1220] text-white">Mañana (Próximos Partidos)</option>
                          <option value="YESTERDAY" className="bg-[#0b1220] text-white">Ayer (Resultados y Marcadores)</option>
                          <option value="CUSTOM" className="bg-[#0b1220] text-white">Fecha: {currentDate}</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-slate-950/40 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2">
                      <Filter className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Filtro de Juego</label>
                        <select
                          value={selectedNBAFilter}
                          onChange={(e) => setSelectedNBAFilter(e.target.value as any)}
                          className="bg-transparent text-xs font-semibold text-white focus:outline-none w-full cursor-pointer"
                        >
                          <option value="ALL" className="bg-[#0b1220] text-white">Todos los partidos</option>
                          <option value="RECOMMENDED" className="bg-[#0b1220] text-amber-300 font-bold">🟢 Te Conviene (Semáforo Verde)</option>
                          <option value="LIVE" className="bg-[#0b1220] text-white">🔴 Solo en vivo (En Duela)</option>
                          <option value="FAVORITES" className="bg-[#0b1220] text-white">⭐ Con favorito claro (&gt;60%)</option>
                          <option value="HIGH_POINTS" className="bg-[#0b1220] text-white">🔥 Alta puntuación (+225 pts)</option>
                          <option value="HIGH_3PM" className="bg-[#0b1220] text-white">🎯 Lluvia de triples (+26 3PM)</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-slate-950/40 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Conferencia</label>
                        <select
                          value={selectedNBAConference}
                          onChange={(e) => setSelectedNBAConference(e.target.value as any)}
                          className="bg-transparent text-xs font-semibold text-white focus:outline-none w-full cursor-pointer"
                        >
                          <option value="ALL" className="bg-[#0b1220] text-white">Toda la NBA</option>
                          <option value="Este" className="bg-[#0b1220] text-white">Conferencia Este</option>
                          <option value="Oeste" className="bg-[#0b1220] text-white">Conferencia Oeste</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4 relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                    <span className="font-semibold text-white">
                      {isNBALoading ? 'Calculando proyecciones...' : `${filteredNBAFixtures.length} partidos NBA`}
                    </span>
                    {hasSelection && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black font-bold">
                        {selectedFixtureIds.size} seleccionados
                      </span>
                    )}
                    {filteredNBAFixtures.some((f) => f.status === 'IN_PLAY') && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[10px] animate-pulse">
                        🔴 En Vivo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {filteredNBAFixtures.length > 0 && (
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
                      >
                        {selectedFixtureIds.size === filteredNBAFixtures.length ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                            <span>Deseleccionar todos</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                            <span>Seleccionar todos</span>
                          </>
                        )}
                      </button>
                    )}

                    {filteredNBAFixtures.length > 0 && (
                      <button
                        onClick={handleToggleExpandAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
                      >
                        {filteredNBAFixtures.every((f) => expandedCardIds.has(f.id)) ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                            <span>Colapsar todos</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            <span>Desplegar todos</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => loadNBAMatches(currentDate, true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors border border-slate-700 cursor-pointer"
                      title="Refrescar marcadores y proyecciones"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isNBALoading ? 'animate-spin text-amber-400' : ''}`} />
                      <span className="hidden sm:inline">Actualizar</span>
                    </button>
                  </div>
                </div>

                {isNBALoading && (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-slate-300 font-medium">
                      Calculando ritmo de posesiones, cuartos y probabilidades Poisson de jugadores...
                    </p>
                  </div>
                )}

                {!isNBALoading && filteredNBAFixtures.length === 0 && (
                  <div className="py-16 text-center space-y-3 bg-slate-900/40 rounded-2xl border border-slate-800 p-8">
                    <div className="w-12 h-12 bg-slate-800/80 rounded-full flex items-center justify-center mx-auto text-slate-400 text-xl">
                      🏀
                    </div>
                    <h3 className="text-base font-bold text-white">
                      {nbaFixtures.length > 0
                        ? 'No se encontraron partidos NBA con este filtro'
                        : 'No hay partidos NBA programados para hoy'}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {nbaFixtures.length > 0
                        ? `Hay ${nbaFixtures.length} partidos oficiales NBA en el calendario de hoy. Prueba cambiando la conferencia o limpiando la búsqueda.`
                        : 'El calendario oficial de ESPN no reporta partidos NBA para esta fecha. Puedes consultar fechas próximas o refrescar.'}
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setNbaSearchQuery('');
                          setSelectedNBAConference('ALL');
                          setSelectedNBAFilter('ALL');
                        }}
                        className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        {nbaFixtures.length > 0 ? `Ver todos los partidos NBA (${nbaFixtures.length})` : 'Limpiar filtros'}
                      </button>
                    </div>
                  </div>
                )}

                {!isNBALoading && filteredNBAFixtures.length > 0 && (
                  <div className="space-y-4">
                    {filteredNBAFixtures.map((fixture) => {
                      const analysis = nbaAnalysesMap[fixture.id];
                      if (!analysis) return null;
                      return (
                        <NBAPredictionCard
                          key={fixture.id}
                          fixture={fixture}
                          analysis={analysis}
                          isSelected={selectedFixtureIds.has(fixture.id)}
                          onToggleSelect={handleToggleSelect}
                          isExpanded={expandedCardIds.has(fixture.id)}
                          onToggleExpand={() => handleToggleCardExpand(fixture.id)}
                          viewMode={viewMode}
                        />
                      );
                    })}
                  </div>
                )}
              </main>
            </>
          )}

          {/* Footer */}
          <footer className="border-t border-slate-800/80 bg-[#070B12]/80 backdrop-blur-md py-8 px-4 sm:px-6 mt-12 text-xs text-slate-400 relative z-10">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {activeSport === 'NBA' ? (
                  <>
                    <span className="text-base">🏀</span>
                    <span className="font-bold text-slate-200">SportStats Pro · NBA</span>
                    <span className="text-slate-600">·</span>
                    <span>Análisis por Cuartos, Props Poisson y Marcadores en Vivo</span>
                  </>
                ) : (
                  <>
                    <Trophy className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-slate-200">SportStats Pro</span>
                    <span className="text-slate-600">·</span>
                    <span>Modelos Probabilísticos y Analítica Deportiva</span>
                  </>
                )}
              </div>

              <div className="text-center sm:text-right text-[11px] text-slate-500">
                Horarios en Hora Colombiana (COT) · Exportación en Excel (.csv) y PDF
              </div>
            </div>
          </footer>

          {/* Fixed Mobile Bottom Navigation Bar (Thumb Zone) */}
          <MobileBottomNav
            activeTab={mobileActiveTab}
            onTabChange={(tab) => {
              setMobileActiveTab(tab);
              if (tab === 'ADMIN') {
                setIsAdminModalOpen(true);
              } else if (tab === 'FILTERS') {
                const el = document.querySelector('input[type="text"]') || document.querySelector('button');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              } else if (tab === 'PROBABILITY') {
                setSelectedFilter('RECOMMENDED');
                window.scrollTo({ top: 120, behavior: 'smooth' });
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            matchesCount={filteredFixtures.length}
            liveMatchesCount={fixtures.filter((f) => f.status === 'IN_PLAY').length}
            onOpenAdmin={() => setIsAdminModalOpen(true)}
          />

          {/* Offline Connectivity Toast Indicator */}
          <OfflineIndicator />
        </div>
      )}

      <SimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        initialFixture={selectedMatchForSimulator}
      />
      <WallpaperSelectorModal
        isOpen={isWallpaperModalOpen}
        onClose={() => setIsWallpaperModalOpen(false)}
        currentWallpaperUrl={selectedWallpaper}
        onSelectWallpaper={handleSelectWallpaper}
        opacity={wallpaperOpacity}
        onChangeOpacity={handleUpdateOpacity}
        blur={wallpaperBlur}
        onChangeBlur={handleUpdateBlur}
      />
      <DidacticGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Persistent Admin License Modal */}
      <AdminLicenseModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLogout={handleLogoutSession}
        onLicenseChanged={async () => {
          try {
            const adminRes = await fetch('/api/admin/session');
            if (adminRes.ok) {
              const session = await adminRes.json();
              if (session.authenticated) {
                setIsAdminSessionActive(true);
                setAdminSessionExpiresAt(session.expiresAt || null);
                setIsAppUnlocked(true);
                setActiveLicenseInfo({
                  isValid: true,
                  status: 'ACTIVE',
                  message: 'Sesión de administrador activa',
                  isPermanent: true,
                  isExpired: false,
                  expiryTimestamp: null,
                  expiryDateFormatted: 'Sesión segura',
                  daysRemaining: null,
                  targetDeviceId: getOrCreateDeviceId(),
                  planLabel: 'Acceso de administrador',
                  clientName: 'Administrador'
                });
                return;
              }
            }
          } catch {
            // Fall through to the customer's license check.
          }

          setIsAdminSessionActive(false);
          setAdminSessionExpiresAt(null);
          const active = getActiveStoredLicense();
          const devId = getOrCreateDeviceId();
          if (active) {
            const check = await restoreCustomerLicense(
              active.key,
              active.offlineGrant,
              active.licensePublicKey,
              devId
            );
            if (!check) clearActiveLicense();
            setIsAppUnlocked(Boolean(check));
            setActiveLicenseInfo(check);
          } else {
            setIsAppUnlocked(false);
            setActiveLicenseInfo(null);
          }
        }}
      />
    </>
  );
}