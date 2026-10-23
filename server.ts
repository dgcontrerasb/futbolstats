import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import {
  isSupabaseConfigured,
  upsertSupabaseAdminConfig,
  fetchSupabaseLicenses,
  lookupSupabaseLicense,
  fetchSupabaseLicenseAccount,
  upsertSupabaseLicense,
  updateSupabaseLicense,
  updateSupabaseLicenseActivity,
  updateSupabaseUserLicenseActivity,
  loginAppUser,
  normalizeUsername,
  registerAppUserRequest,
  adminListAppUsers,
  adminResetAppUserDevice,
  adminRenewAppUser,
  adminToggleAppUserStatus,
  adminUpsertAppUser,
  SUPABASE_SQL_SCHEMA,
  isAdminLoginThrottleConfigured,
  consumeAdminLoginAttempt,
  isClientLoginThrottleConfigured,
  consumeClientLoginAttempt
} from './src/services/supabaseServer.ts';

dotenv.config();

// HMR is disabled in AI Studio environment to prevent WebSocket errors and save resources
if (!process.env.DISABLE_HMR) {
  process.env.DISABLE_HMR = 'true';
}

// Anticaída de proceso Node.js ante excepciones no capturadas o rechazos de promesas
process.on('uncaughtException', (err) => {
  console.error('[Process uncaughtException Protected]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process unhandledRejection Protected]:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.set('trust proxy', 1);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

const ADMIN_SESSION_COOKIE = 'sportstats_admin_session';
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_WINDOW_SECONDS = ADMIN_LOGIN_WINDOW_MS / 1000;
const CLIENT_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const CLIENT_LOGIN_MAX_ATTEMPTS = 5;
const CLIENT_LOGIN_WINDOW_SECONDS = CLIENT_LOGIN_WINDOW_MS / 1000;
const LICENSE_OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000;

interface LicenseTokenClaims {
  type: 'account' | 'offline';
  userId?: string;
  licenseKey?: string;
  deviceId: string;
  issuedAt: number;
  expiresAt: number | null;
  offlineExpiresAt?: number;
  planType: string;
  planLabel: string;
  clientName?: string;
}

function getLicenseSigningKeys(): { privateKey: crypto.KeyObject; publicKey: string } | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) return null;

  const seed = crypto
    .createHmac('sha256', serviceRoleKey)
    .update('sportstats-pro/license-offline-signing/v1')
    .digest();
  const privateDer = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    seed
  ]);
  const privateKey = crypto.createPrivateKey({ key: privateDer, format: 'der', type: 'pkcs8' });
  const publicKey = crypto.createPublicKey(privateKey)
    .export({ format: 'der', type: 'spki' })
    .toString('base64');
  return { privateKey, publicKey };
}

function signLicenseToken(prefix: 'SA1' | 'OF1', claims: LicenseTokenClaims): string | null {
  const keys = getLicenseSigningKeys();
  if (!keys) return null;
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const content = `${prefix}.${payload}`;
  const signature = crypto.sign(null, Buffer.from(content), keys.privateKey).toString('base64url');
  return `${content}.${signature}`;
}

function verifyLicenseToken(
  token: string,
  prefix: 'SA1' | 'OF1'
): LicenseTokenClaims | null {
  const keys = getLicenseSigningKeys();
  if (!keys) return null;
  const [tokenPrefix, payload, signature, extra] = token.split('.');
  if (tokenPrefix !== prefix || !payload || !signature || extra) return null;

  try {
    const content = `${tokenPrefix}.${payload}`;
    const verified = crypto.verify(
      null,
      Buffer.from(content),
      crypto.createPublicKey(keys.privateKey),
      Buffer.from(signature, 'base64url')
    );
    if (!verified) return null;

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as LicenseTokenClaims;
    if (
      !claims ||
      typeof claims.deviceId !== 'string' ||
      !Number.isFinite(claims.issuedAt) ||
      (claims.expiresAt !== null && !Number.isFinite(claims.expiresAt)) ||
      typeof claims.planType !== 'string' ||
      typeof claims.planLabel !== 'string'
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

function getAdminSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  return secret && Buffer.byteLength(secret) >= 32 ? secret : null;
}

function isAdminAuthConfigured(): boolean {
  return /^\d{6,}$/.test(process.env.ADMIN_PIN || '') &&
    Boolean(getAdminSessionSecret()) &&
    isAdminLoginThrottleConfigured();
}

function safeEqual(left: string, right: string): boolean {
  const leftHash = crypto.createHash('sha256').update(left).digest();
  const rightHash = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function getAdminSessionToken(req: express.Request): string | null {
  const cookies = req.headers.cookie?.split(';') || [];
  const cookie = cookies.find((entry) => entry.trim().startsWith(`${ADMIN_SESSION_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(ADMIN_SESSION_COOKIE.length + 1)) : null;
}

function isAdminSessionValid(req: express.Request): boolean {
  const secret = getAdminSessionSecret();
  const token = getAdminSessionToken(req);
  if (!secret || !token) return false;

  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;

  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const currentPinVersion = crypto.createHash('sha256').update(process.env.ADMIN_PIN || '').digest('hex');
    return Number.isFinite(session.expiresAt) &&
      session.expiresAt > Date.now() &&
      safeEqual(session.pinVersion || '', currentPinVersion);
  } catch {
    return false;
  }
}

function setAdminSessionCookie(res: express.Response): void {
  const secret = getAdminSessionSecret();
  if (!secret) throw new Error('Admin session secret is not configured');

  const payload = Buffer.from(JSON.stringify({
    expiresAt: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000,
    pinVersion: crypto.createHash('sha256').update(process.env.ADMIN_PIN || '').digest('hex'),
    nonce: crypto.randomBytes(16).toString('hex')
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(`${payload}.${signature}`)}; HttpOnly; Path=/api; SameSite=Strict; Max-Age=${ADMIN_SESSION_TTL_SECONDS}${secure ? '; Secure' : ''}`
  );
}

function clearAdminSessionCookie(res: express.Response): void {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=/api; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`
  );
}

function isSameOriginRequest(req: express.Request): boolean {
  const origin = req.get('origin');
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!origin || !host) return false;

  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function requireAdminSession(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!isAdminAuthConfigured()) {
    res.status(503).json({ success: false, code: 'ADMIN_AUTH_NOT_CONFIGURED', error: 'La autenticación administrativa no está configurada.' });
    return;
  }
  if (!isAdminSessionValid(req)) {
    res.status(401).json({ success: false, code: 'ADMIN_SESSION_REQUIRED', error: 'Sesión administrativa requerida.' });
    return;
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isSameOriginRequest(req)) {
    res.status(403).json({ success: false, error: 'Origen de solicitud no permitido.' });
    return;
  }
  next();
}

function adminSessionExpiresAt(req: express.Request): number | null {
  const token = getAdminSessionToken(req);
  const payload = token?.split('.')[0];
  if (!payload) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(session.expiresAt) ? session.expiresAt : null;
  } catch {
    return null;
  }
}

// Health check ultra liviano para supervisión del entorno de AI Studio
app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  });
});

// Server-side persistent disk cache + In-Flight request deduplication (Single-Flight coalescing)
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);
const CACHE_DIR = IS_VERCEL ? path.resolve('/tmp', '.cache') : path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.resolve(CACHE_DIR, 'api_football_cache.json');

interface CacheRecord<T = unknown> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheRecord>();
const inFlightRequests = new Map<string, Promise<unknown>>();

// Quota Shield State (API-Football has 100 free requests/day)
let lastRemainingCalls = 100;
let quotaShieldActive = false;
const QUOTA_SHIELD_THRESHOLD = 10;

// Initialize cache from disk on server startup
function initDiskCache(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === 'object' && 'timestamp' in (v as any) && 'data' in (v as any)) {
            memoryCache.set(k, v as CacheRecord);
          }
        }
      }
      console.log(`[Cache] Cargadas ${memoryCache.size} entradas de caché persistente en disco.`);
    }
  } catch (err) {
    console.warn('[Cache] No se pudo cargar caché desde disco:', err);
  }
}

initDiskCache();

let persistTimeout: NodeJS.Timeout | null = null;
function persistCacheToDisk(): void {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const dump: Record<string, CacheRecord> = {};
      memoryCache.forEach((val, key) => {
        dump[key] = val;
      });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(dump), 'utf8');
    } catch (err) {
      console.warn('[Cache] Error al guardar caché en disco:', err);
    }
  }, 1000);
}

function getCacheItem<T = unknown>(key: string): CacheRecord<T> | undefined {
  return memoryCache.get(key) as CacheRecord<T> | undefined;
}

function setCacheItem<T = unknown>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
  persistCacheToDisk();
}

function updateQuotaFromHeaders(headers: Headers): void {
  const rem = headers.get('x-ratelimit-requests-remaining');
  if (rem) {
    const val = parseInt(rem, 10);
    if (!isNaN(val)) {
      lastRemainingCalls = val;
      quotaShieldActive = val <= QUOTA_SHIELD_THRESHOLD;
    }
  }
}

async function runSingleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = (async () => {
    try {
      return await fn();
    } finally {
      inFlightRequests.delete(key);
    }
  })();
  inFlightRequests.set(key, promise);
  return promise;
}

// Helper to get active secret key from environment or .env
function getSecretKey(keyName: string): string {
  const envVal = process.env[keyName];
  if (envVal && envVal.trim()) {
    return envVal.trim();
  }
  // Try reading from .env if dynamically written
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`${keyName}=["']?([^"'\\r\\n]+)["']?`);
      const match = content.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {
    // ignore
  }
  return '';
}

function getSecretApiKey(): string {
  return getSecretKey('API_FOOTBALL_KEY');
}

function getColombiaDateStr(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

// 0. Upcoming Matches Endpoint: STRICTLY matches that have NOT been played yet
// Optimized with 25-minute TTL, single-flight coalescing, and disk persistence
app.get('/api/upcoming', async (req, res) => {
  const apiKey = getSecretApiKey();
  const requestedDate = (req.query.date as string) || '';
  const query = ((req.query.q as string) || '').toLowerCase().trim();
  const force = req.query.force === 'true';

  const todayColombia = getColombiaDateStr(0);
  const targetDate = requestedDate || todayColombia;

  const cacheKey = `upcoming_${targetDate}`;
  const cached = getCacheItem<any[]>(cacheKey);

  // 25 minutes TTL for today's matches (preserves daily quota), 24 hours for other dates
  const cacheTTL = targetDate === todayColombia ? 25 * 60 * 1000 : 24 * 60 * 60 * 1000;

  // 1. Check persistent cache: Serve immediately if fresh OR if quota shield is active
  if (cached && !query) {
    const isFresh = Date.now() - cached.timestamp < cacheTTL;
    if ((isFresh && !force) || quotaShieldActive) {
      let filtered = cached.data;
      return res.json({
        success: true,
        source: 'persistent_disk_cache',
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        cachedAt: cached.timestamp,
        count: Array.isArray(filtered) ? filtered.length : 0,
        fixtures: filtered
      });
    }
  }

  // 2. If quota shield is active (< 10 calls remaining) and no cache exists, guard against quota exhaustion
  if (quotaShieldActive && !force) {
    if (cached) {
      return res.json({
        success: true,
        source: 'quota_shield_disk_cache',
        remainingCalls: lastRemainingCalls,
        quotaShieldActive: true,
        count: Array.isArray(cached.data) ? cached.data.length : 0,
        fixtures: cached.data
      });
    }
  }

  if (!apiKey) {
    return res.json({
      success: false,
      message: 'No secret API key configured on server.',
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: cached?.data || []
    });
  }

  // 3. Single-Flight Coalescing: Ensure only 1 outbound API call executes even if multiple users request at once
  try {
    const resultList = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(`https://v3.football.api-sports.io/fixtures?date=${targetDate}&timezone=America/Bogota`, {
        method: 'GET',
        headers: { 'x-apisports-key': apiKey }
      });

      updateQuotaFromHeaders(apiRes.headers);

      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }

      const json = await apiRes.json();
      let rawList = Array.isArray(json.response) ? json.response : [];
      const now = Date.now();

      // Filter out synthetic/test fixture IDs
      rawList = rawList.filter((f: any) => {
        const id = f?.fixture?.id;
        return id !== 991001 && id !== 991002 && id !== 991003;
      });

      const activeFinishedShorts = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];
      let upcomingOnly = rawList.filter((f: any) => {
        const statusShort = String(f.fixture?.status?.short || '').toUpperCase();
        const matchTime = f.fixture?.timestamp ? f.fixture.timestamp * 1000 : new Date(f.fixture?.date).getTime();
        const isLive = ['1H', '2H', 'HT', 'ET', 'LIVE', 'BT', 'P', 'INT'].includes(statusShort);
        if (isLive) return true;
        if (activeFinishedShorts.includes(statusShort)) return false;
        return matchTime > now - 45 * 60 * 1000;
      });

      // If fewer than 15 upcoming matches remain tonight in Colombia, fetch tomorrow's games to enrich catalog
      if (targetDate === todayColombia && upcomingOnly.length < 15 && lastRemainingCalls > QUOTA_SHIELD_THRESHOLD) {
        const tomorrowColombia = getColombiaDateStr(1);
        try {
          const tomorrowRes = await fetch(`https://v3.football.api-sports.io/fixtures?date=${tomorrowColombia}&timezone=America/Bogota`, {
            method: 'GET',
            headers: { 'x-apisports-key': apiKey }
          });
          updateQuotaFromHeaders(tomorrowRes.headers);
          if (tomorrowRes.ok) {
            const tomorrowJson = await tomorrowRes.json();
            if (Array.isArray(tomorrowJson.response)) {
              const tomorrowUpcoming = tomorrowJson.response.filter((f: any) => {
                const statusShort = String(f.fixture?.status?.short || '').toUpperCase();
                return !activeFinishedShorts.includes(statusShort);
              });
              upcomingOnly = [...upcomingOnly, ...tomorrowUpcoming];
            }
          }
        } catch {
          // ignore secondary fetch failure
        }
      }

      upcomingOnly.sort((a: any, b: any) => {
        const sA = String(a.fixture?.status?.short || '').toUpperCase();
        const sB = String(b.fixture?.status?.short || '').toUpperCase();
        const liveA = ['1H', '2H', 'HT', 'ET', 'LIVE'].includes(sA) ? 0 : 1;
        const liveB = ['1H', '2H', 'HT', 'ET', 'LIVE'].includes(sB) ? 0 : 1;
        if (liveA !== liveB) return liveA - liveB;
        const tA = a.fixture?.timestamp || 0;
        const tB = b.fixture?.timestamp || 0;
        return tA - tB;
      });

      setCacheItem(cacheKey, upcomingOnly);
      return upcomingOnly;
    });

    let filtered = resultList;
    if (query) {
      filtered = resultList.filter((f: any) => {
        const hName = (f.teams?.home?.name || '').toLowerCase();
        const aName = (f.teams?.away?.name || '').toLowerCase();
        const lName = (f.league?.name || '').toLowerCase();
        return hName.includes(query) || aName.includes(query) || lName.includes(query);
      });
    }

    return res.json({
      success: true,
      source: 'api_football_coalesced',
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      count: filtered.length,
      fixtures: filtered
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cached) {
      return res.json({
        success: true,
        source: 'fallback_disk_cache',
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        fixtures: cached.data
      });
    }
    return res.json({ success: false, error: msg, fixtures: [] });
  }
});

// Normalize team names for fuzzy matching between ESPN Live Scoreboard and API-Football fixtures
function normalizeTeamKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|cd|ud|club|deportivo|atletico|athletic|real|sporting)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// 0.25 Hybrid Live Pulse Endpoint (45-second real-time scoreboard sync - 0 API-Football quota consumed)
app.get('/api/live-pulse', async (req, res) => {
  const requestedDate = (req.query.date as string) || '';
  const todayColombia = getColombiaDateStr(0);
  const targetDate = requestedDate || todayColombia;
  const espnDateStr = targetDate.replace(/-/g, '');

  const pulseCacheKey = `live_pulse_${espnDateStr}`;
  const cachedPulse = getCacheItem<any[]>(pulseCacheKey);

  // 35-second TTL so 45-second client polling always gets fresh data while coalescing concurrent tabs
  if (cachedPulse && Date.now() - cachedPulse.timestamp < 35 * 1000) {
    return res.json({
      success: true,
      source: 'hybrid_memory_pulse',
      timestamp: cachedPulse.timestamp,
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      deltas: cachedPulse.data
    });
  }

  try {
    const deltas = await runSingleFlight(pulseCacheKey, async () => {
      const liveDeltas: Array<{
        id?: string;
        homeKey: string;
        awayKey: string;
        homeName: string;
        awayName: string;
        homeScore: number;
        awayScore: number;
        minute: number;
        status: 'IN_PLAY' | 'FINISHED' | 'SCHEDULED';
      }> = [];

      // 1. Fetch public real-time multi-league soccer scoreboard (0 API-Football quota)
      try {
        const espnRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${espnDateStr}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FutbolStatsPro/3.0'
            }
          }
        );

        if (espnRes.ok) {
          const espnData = await espnRes.json();
          const events = Array.isArray(espnData?.events) ? espnData.events : [];

          for (const ev of events) {
            const comp = ev?.competitions?.[0];
            if (!comp) continue;
            const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
            const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
            const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
            if (!homeComp || !awayComp) continue;

            const state = String(ev?.status?.type?.state || '').toLowerCase();
            const isLive = state === 'in';
            const isPost = state === 'post';
            if (!isLive && !isPost) continue;

            const homeName = String(homeComp?.team?.displayName || homeComp?.team?.name || '');
            const awayName = String(awayComp?.team?.displayName || awayComp?.team?.name || '');
            const homeScore = parseInt(String(homeComp?.score || '0'), 10) || 0;
            const awayScore = parseInt(String(awayComp?.score || '0'), 10) || 0;
            const rawClock = String(ev?.status?.displayClock || '45');
            const parsedMin = parseInt(rawClock.replace(/[^0-9]/g, ''), 10) || 45;

            liveDeltas.push({
              homeKey: normalizeTeamKey(homeName),
              awayKey: normalizeTeamKey(awayName),
              homeName,
              awayName,
              homeScore,
              awayScore,
              minute: Math.min(90, Math.max(1, parsedMin)),
              status: isLive ? 'IN_PLAY' : 'FINISHED'
            });
          }
        }
      } catch {
        // Ignore external ESPN scoreboard hiccup and fall back to cached live state progression
      }

      // 2. Sync & progress any IN_PLAY matches inside our persistent upcoming cache
      const upcomingCache = getCacheItem<any[]>(`upcoming_${targetDate}`);
      if (upcomingCache && Array.isArray(upcomingCache.data)) {
        const elapsedMinutesSinceCache = Math.max(
          0,
          Math.floor((Date.now() - upcomingCache.timestamp) / 60000)
        );

        for (const f of upcomingCache.data) {
          const fId = String(f?.fixture?.id || '');
          const hName = String(f?.teams?.home?.name || '');
          const aName = String(f?.teams?.away?.name || '');
          const hKey = normalizeTeamKey(hName);
          const aKey = normalizeTeamKey(aName);

          // Check if matched in ESPN live feed
          const matched = liveDeltas.find(
            (d) =>
              (d.homeKey && hKey && (d.homeKey.includes(hKey) || hKey.includes(d.homeKey))) ||
              (d.awayKey && aKey && (d.awayKey.includes(aKey) || aKey.includes(d.awayKey)))
          );

          if (matched) {
            matched.id = fId;
            if (f.goals) {
              f.goals.home = matched.homeScore;
              f.goals.away = matched.awayScore;
            }
            if (f.fixture?.status) {
              f.fixture.status.short = matched.status === 'IN_PLAY' ? '2H' : 'FT';
              f.fixture.status.elapsed = matched.minute;
            }
            continue;
          }

          // If already IN_PLAY in API-Football cache, advance the clock naturally every minute
          const statusShort = String(f?.fixture?.status?.short || '').toUpperCase();
          if (['1H', '2H', 'HT', 'ET', 'LIVE'].includes(statusShort)) {
            const baseElapsed = parseInt(String(f?.fixture?.status?.elapsed || '45'), 10) || 45;
            const currentMin =
              statusShort === 'HT'
                ? 45
                : Math.min(90, baseElapsed + (elapsedMinutesSinceCache % 15));
            liveDeltas.push({
              id: fId,
              homeKey: hKey,
              awayKey: aKey,
              homeName: hName,
              awayName: aName,
              homeScore: Number(f?.goals?.home ?? 0),
              awayScore: Number(f?.goals?.away ?? 0),
              minute: currentMin,
              status: 'IN_PLAY'
            });
          }
        }
      }

      setCacheItem(pulseCacheKey, liveDeltas);
      return liveDeltas;
    });

    return res.json({
      success: true,
      source: 'hybrid_live_pulse',
      timestamp: Date.now(),
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      deltas
    });
  } catch (err: unknown) {
    return res.json({
      success: false,
      timestamp: Date.now(),
      deltas: [],
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// 0.5 NBA Live & Scheduled Scoreboard endpoint (Official ESPN Feed - 0 API-Football quota consumed)
app.get('/api/nba/scoreboard', async (req, res) => {
  const dateQuery = (req.query.date as string) || '';
  const force = req.query.force === 'true';
  const todayColombia = getColombiaDateStr(0);
  const targetDate = dateQuery || todayColombia;

  const espnDateStr = targetDate.replace(/-/g, '');
  const cacheKey = `nba_sb_${espnDateStr}`;
  const cached = getCacheItem<any[]>(cacheKey);

  // Scoreboard cache TTL: 3 minutes for today's games, 24 hours for historical/future
  const cacheTTL = targetDate === todayColombia ? 3 * 60 * 1000 : 24 * 60 * 60 * 1000;
  if (cached && !force && Date.now() - cached.timestamp < cacheTTL) {
    return res.json({
      success: true,
      source: 'persistent_disk_cache',
      date: targetDate,
      events: cached.data
    });
  }

  try {
    const rawEvents = await runSingleFlight(cacheKey, async () => {
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDateStr}`;
      const apiRes = await fetch(espnUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BasketStats/2.0'
        }
      });

      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }

      const data = await apiRes.json();
      const events = Array.isArray(data.events) ? data.events : [];
      setCacheItem(cacheKey, events);
      return events;
    });

    return res.json({
      success: true,
      source: 'espn_official_coalesced',
      date: targetDate,
      events: rawEvents
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cached) {
      return res.json({ success: true, source: 'fallback_disk_cache', date: targetDate, events: cached.data });
    }
    return res.json({ success: false, error: msg, events: [] });
  }
});

// 1. Secret Proxy Endpoint: GET /api/fixtures?date=YYYY-MM-DD
// Optimized with 25-minute TTL, single-flight coalescing, and quota shield
app.get('/api/fixtures', async (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const force = req.query.force === 'true';
  const apiKey = getSecretApiKey();

  const cacheKey = `fix_${date}`;
  const cached = getCacheItem<any[]>(cacheKey);
  const todayStr = new Date().toISOString().split('T')[0];
  const cacheTTL = date === todayStr ? 25 * 60 * 1000 : 24 * 60 * 60 * 1000;

  if (cached && (!force || quotaShieldActive)) {
    const isFresh = Date.now() - cached.timestamp < cacheTTL;
    if (isFresh || quotaShieldActive) {
      return res.status(200).json({
        success: true,
        source: 'persistent_disk_cache',
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        fixtures: cached.data
      });
    }
  }

  if (quotaShieldActive && cached) {
    return res.status(200).json({
      success: true,
      source: 'quota_shield_disk_cache',
      remainingCalls: lastRemainingCalls,
      quotaShieldActive: true,
      fixtures: cached.data
    });
  }

  if (!apiKey) {
    return res.status(200).json({
      success: false,
      message: 'No secret API key configured on server. Fallback to cache.',
      hasKey: false,
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: cached?.data || []
    });
  }

  try {
    const rawFixtures = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}&timezone=America/Bogota`, {
        method: 'GET',
        headers: { 'x-apisports-key': apiKey }
      });

      updateQuotaFromHeaders(apiRes.headers);

      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }

      const json = await apiRes.json();
      const fixtures = Array.isArray(json.response) ? json.response : [];
      if (fixtures.length > 0) {
        setCacheItem(cacheKey, fixtures);
      }
      return fixtures;
    });

    return res.status(200).json({
      success: true,
      source: 'api_football_coalesced',
      remainingCalls: lastRemainingCalls,
      quotaShieldActive,
      fixtures: rawFixtures
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (cached) {
      return res.status(200).json({
        success: true,
        source: 'fallback_disk_cache',
        remainingCalls: lastRemainingCalls,
        quotaShieldActive,
        fixtures: cached.data
      });
    }
    return res.status(200).json({
      success: false,
      error: message,
      fixtures: []
    });
  }
});

// 2. Secret Key & Quota Status check: GET /api/status
app.get('/api/status', (req, res) => {
  const apiFootballKey = getSecretKey('API_FOOTBALL_KEY');
  const footballDataKey = getSecretKey('FOOTBALL_DATA_KEY');
  const oddsApiKey = getSecretKey('ODDS_API_KEY');

  return res.json({
    apiFootball: Boolean(apiFootballKey && apiFootballKey.length > 5),
    footballData: Boolean(footballDataKey && footballDataKey.length > 5),
    oddsApi: Boolean(oddsApiKey && oddsApiKey.length > 5),
    remainingCalls: lastRemainingCalls,
    quotaShieldActive: lastRemainingCalls <= QUOTA_SHIELD_THRESHOLD,
    quotaShieldThreshold: QUOTA_SHIELD_THRESHOLD,
    cachedEntriesCount: memoryCache.size,
    cacheTtlMinutes: 25,
    serverReady: true
  });
});

// 2b. Proxy for The Odds API (Real market odds - 60 min TTL + Coalescing)
app.get('/api/market-odds', async (req, res) => {
  const oddsKey = getSecretKey('ODDS_API_KEY');
  const cacheKey = 'odds_soccer';
  const cached = getCacheItem<any>(cacheKey);

  if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
    return res.json({ success: true, source: 'persistent_disk_cache', odds: cached.data });
  }

  if (!oddsKey) {
    return res.json({ success: false, message: 'No The Odds API key configured.', odds: cached?.data || [] });
  }

  try {
    const data = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?apiKey=${oddsKey}&regions=eu&markets=h2h`,
        { method: 'GET' }
      );
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }
      const fetched = await apiRes.json();
      setCacheItem(cacheKey, fetched);
      return fetched;
    });
    return res.json({ success: true, source: 'the_odds_api_coalesced', odds: data });
  } catch (err) {
    if (cached) return res.json({ success: true, source: 'fallback_disk_cache', odds: cached.data });
    return res.json({ success: false, error: String(err), odds: [] });
  }
});

// 2c. Proxy for Football-Data.org (Official Standings - 120 min TTL + Coalescing)
app.get('/api/standings', async (req, res) => {
  const fdKey = getSecretKey('FOOTBALL_DATA_KEY');
  const league = (req.query.league as string) || 'PD';
  const cacheKey = `standings_${league}`;
  const cached = getCacheItem<any>(cacheKey);

  if (cached && Date.now() - cached.timestamp < 2 * 60 * 60 * 1000) {
    return res.json({ success: true, source: 'persistent_disk_cache', standings: cached.data });
  }

  if (!fdKey) {
    return res.json({ success: false, message: 'No Football-Data key configured.', standings: cached?.data || [] });
  }

  try {
    const data = await runSingleFlight(cacheKey, async () => {
      const apiRes = await fetch(`https://api.football-data.org/v4/competitions/${league}/standings`, {
        method: 'GET',
        headers: { 'X-Auth-Token': fdKey }
      });
      if (!apiRes.ok) {
        if (cached) return cached.data;
        return [];
      }
      const fetched = await apiRes.json();
      setCacheItem(cacheKey, fetched);
      return fetched;
    });
    return res.json({ success: true, source: 'football_data_coalesced', standings: data });
  } catch (err) {
    if (cached) return res.json({ success: true, source: 'fallback_disk_cache', standings: cached.data });
    return res.json({ success: false, error: String(err), standings: [] });
  }
});

// 3. Secret Key Setup endpoint: POST /api/set-secret-key
// Saves API keys directly to .env on server without returning them or exposing them in the client bundle
app.post('/api/set-secret-key', requireAdminSession, (req, res) => {
  const { key, footballDataKey, oddsApiKey } = req.body;
  
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    if (key && typeof key === 'string' && key.trim()) {
      const clean = key.trim();
      process.env.API_FOOTBALL_KEY = clean;
      if (envContent.includes('API_FOOTBALL_KEY=')) {
        envContent = envContent.replace(/API_FOOTBALL_KEY=.*/g, `API_FOOTBALL_KEY="${clean}"`);
      } else {
        envContent += `\nAPI_FOOTBALL_KEY="${clean}"\n`;
      }
    }

    if (footballDataKey && typeof footballDataKey === 'string' && footballDataKey.trim()) {
      const clean = footballDataKey.trim();
      process.env.FOOTBALL_DATA_KEY = clean;
      if (envContent.includes('FOOTBALL_DATA_KEY=')) {
        envContent = envContent.replace(/FOOTBALL_DATA_KEY=.*/g, `FOOTBALL_DATA_KEY="${clean}"`);
      } else {
        envContent += `\nFOOTBALL_DATA_KEY="${clean}"\n`;
      }
    }

    if (oddsApiKey && typeof oddsApiKey === 'string' && oddsApiKey.trim()) {
      const clean = oddsApiKey.trim();
      process.env.ODDS_API_KEY = clean;
      if (envContent.includes('ODDS_API_KEY=')) {
        envContent = envContent.replace(/ODDS_API_KEY=.*/g, `ODDS_API_KEY="${clean}"`);
      } else {
        envContent += `\nODDS_API_KEY="${clean}"\n`;
      }
    }

    fs.writeFileSync(envPath, envContent, 'utf8');

    return res.json({
      success: true,
      message: 'Claves configuradas en el servidor de forma 100% segura y privada (nunca visibles en el cliente).'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// 4. Clear server-side persistent cache
const ADMIN_CONFIG_FILE = IS_VERCEL ? path.resolve('/tmp', 'admin_config.json') : path.resolve(__dirname, 'admin_config.json');
const BUNDLED_ADMIN_CONFIG_FILE = path.resolve(__dirname, 'admin_config.json');

interface AdminConfig {
  adminWhatsApp: string;
  supportName: string;
  customLogoUrl?: string;
  colorTheme?: string;
}

let memoryAdminConfig: AdminConfig | null = null;

function getAdminConfig(): AdminConfig {
  const defaultConfig: AdminConfig = {
    adminWhatsApp: process.env.ADMIN_WHATSAPP || '573213902708',
    supportName: 'Administrador SportStats Pro',
    customLogoUrl: '/custom-logo.png',
    colorTheme: 'cyan-emerald'
  };
  if (memoryAdminConfig) {
    return memoryAdminConfig;
  }
  try {
    if (fs.existsSync(ADMIN_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf8'));
      const publicConfig = { ...data };
      delete publicConfig.adminPin;
      const resolved: AdminConfig = { ...defaultConfig, ...publicConfig };
      memoryAdminConfig = resolved;
      return resolved;
    }
    if (fs.existsSync(BUNDLED_ADMIN_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(BUNDLED_ADMIN_CONFIG_FILE, 'utf8'));
      const publicConfig = { ...data };
      delete publicConfig.adminPin;
      const resolved: AdminConfig = { ...defaultConfig, ...publicConfig };
      memoryAdminConfig = resolved;
      return resolved;
    }
  } catch {
    // fallback
  }
  return defaultConfig;
}

function saveAdminConfig(cfg: AdminConfig): void {
  memoryAdminConfig = { ...cfg };
  try {
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving admin config:', e);
  }
  if (isSupabaseConfigured()) {
    upsertSupabaseAdminConfig(cfg).catch((err) => console.warn('[Supabase Sync Config Error]:', err));
  }
}

interface ServerLicenseRecord {
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
}

function normalizeLicenseDeviceId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().replace(/^DEV/, '');
}

function makeOfflineGrant(claims: Omit<LicenseTokenClaims, 'type' | 'issuedAt' | 'offlineExpiresAt'>): string | null {
  const now = Date.now();
  const offlineExpiresAt = claims.expiresAt === null
    ? now + LICENSE_OFFLINE_GRACE_MS
    : Math.min(now + LICENSE_OFFLINE_GRACE_MS, claims.expiresAt);
  if (offlineExpiresAt <= now) return null;
  return signLicenseToken('OF1', {
    ...claims,
    type: 'offline',
    issuedAt: now,
    offlineExpiresAt
  });
}

function serverGenerateToken(deviceId: string, planType: string, customExpiryMs?: number): { key: string; expiresAt: number | null; planLabel: string } {
  const cleanDev = deviceId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().replace(/^DEV/, '');
  const nowMs = Date.now();
  let expiresAt: number | null = null;
  let planTag = '30D';
  let planLabel = 'Pase 30 Días';

  switch (planType) {
    case '24H':
      expiresAt = nowMs + 24 * 60 * 60 * 1000;
      planTag = '24H';
      planLabel = 'Prueba 24 Horas';
      break;
    case '7D':
      expiresAt = nowMs + 7 * 24 * 60 * 60 * 1000;
      planTag = '7D';
      planLabel = 'Pase Semanal (7 Días)';
      break;
    case '15D':
      expiresAt = nowMs + 15 * 24 * 60 * 60 * 1000;
      planTag = '15D';
      planLabel = 'Pase Quincenal (15 Días)';
      break;
    case '30D':
      expiresAt = nowMs + 30 * 24 * 60 * 60 * 1000;
      planTag = '30D';
      planLabel = 'Pase Mensual (30 Días)';
      break;
    case '90D':
      expiresAt = nowMs + 90 * 24 * 60 * 60 * 1000;
      planTag = '90D';
      planLabel = 'Pase Trimestral (90 Días)';
      break;
    case 'PERMANENT':
      expiresAt = null;
      planTag = 'VIP';
      planLabel = 'Pase Permanente Vitalicio';
      break;
    case 'CUSTOM':
      expiresAt = customExpiryMs || (nowMs + 30 * 24 * 60 * 60 * 1000);
      planTag = 'CUS';
      const days = Math.max(1, Math.round((expiresAt - nowMs) / (24 * 60 * 60 * 1000)));
      planLabel = `Pase Personalizado (${days} días)`;
      break;
  }

  const expSeconds = expiresAt === null ? 0 : Math.floor(expiresAt / 1000);
  const expHex = expSeconds.toString(16).toUpperCase().padStart(8, '0');

  const sig8 = crypto.randomBytes(16).toString('hex').toUpperCase();

  const key = `FS-${planTag}-${cleanDev}-${expHex}-${sig8}`;
  return { key, expiresAt, planLabel };
}

interface LicenseValidationPayload {
  isValid: boolean;
  status: string;
  message: string;
  isPermanent: boolean;
  isExpired: boolean;
  expiryTimestamp: number | null;
  daysRemaining: number | null;
  planLabel: string;
  clientName?: string;
  offlineGrant?: string;
  licensePublicKey?: string;
}

type LicenseValidationOutcome = {
  httpStatus: number;
  payload: LicenseValidationPayload & { error?: string };
};

function rejectedLicense(status: string, message: string, expiresAt: number | null = null, planLabel = 'Desconocido'): LicenseValidationOutcome {
  return {
    httpStatus: 200,
    payload: {
      isValid: false,
      status,
      message,
      isPermanent: false,
      isExpired: status === 'EXPIRED',
      expiryTimestamp: expiresAt,
      daysRemaining: status === 'EXPIRED' ? 0 : null,
      planLabel
    }
  };
}

async function validateLicenseAccess(
  key: string,
  deviceId: string,
  clientName?: string,
  deviceInfo?: string
): Promise<LicenseValidationOutcome> {
  const cleanDevice = normalizeLicenseDeviceId(deviceId);
  let offlineClaims: Omit<LicenseTokenClaims, 'type' | 'issuedAt' | 'offlineExpiresAt'>;
  let planLabel: string;
  let planType: string;
  let expiresAt: number | null;
  let resolvedClientName: string | undefined;

  if (key.startsWith('SA1.')) {
    const credential = verifyLicenseToken(key, 'SA1');
    if (
      !credential ||
      credential.type !== 'account' ||
      !credential.userId ||
      normalizeLicenseDeviceId(credential.deviceId) !== cleanDevice
    ) {
      return rejectedLicense('INVALID_SIGNATURE', 'Credencial de acceso inválida.');
    }

    const lookup = await fetchSupabaseLicenseAccount(credential.userId);
    if (lookup.status === 'unavailable') {
      return {
        httpStatus: 503,
        payload: {
          isValid: false,
          status: 'SERVER_UNAVAILABLE',
          message: 'No se pudo consultar el estado de la cuenta.',
          isPermanent: false,
          isExpired: false,
          expiryTimestamp: null,
          daysRemaining: null,
          planLabel: 'No disponible',
          error: 'LICENSE_STORAGE_UNAVAILABLE'
        }
      };
    }
    if (lookup.status === 'not_found') {
      return rejectedLicense('REVOKED', 'La cuenta ya no está disponible.');
    }

    const account = lookup.account;
    if (account.role !== 'client' || account.status !== 'active') {
      return rejectedLicense('REVOKED', 'La cuenta está suspendida o inactiva.', account.expiresAt, account.planLabel);
    }
    if (normalizeLicenseDeviceId(account.boundDeviceId || '') !== cleanDevice) {
      return rejectedLicense('INVALID_DEVICE', 'La cuenta está vinculada a otro dispositivo.', account.expiresAt, account.planLabel);
    }
    expiresAt = account.expiresAt;
    if (expiresAt !== null && expiresAt <= Date.now()) {
      return rejectedLicense('EXPIRED', 'El plan de acceso ha vencido.', expiresAt, account.planLabel);
    }
    planLabel = account.planLabel;
    planType = account.planType;
    resolvedClientName = account.displayName || account.username;
    offlineClaims = {
      userId: account.id,
      deviceId: cleanDevice,
      expiresAt,
      planType,
      planLabel,
      clientName: resolvedClientName
    };
    if (!await updateSupabaseUserLicenseActivity(account.id)) {
      return {
        httpStatus: 503,
        payload: {
          isValid: false,
          status: 'SERVER_UNAVAILABLE',
          message: 'No se pudo guardar la actividad de la cuenta.',
          isPermanent: false,
          isExpired: false,
          expiryTimestamp: expiresAt,
          daysRemaining: null,
          planLabel,
          error: 'LICENSE_STORAGE_UNAVAILABLE'
        }
      };
    }
  } else {
    const lookup = await lookupSupabaseLicense(key);
    if (lookup.status === 'unavailable') {
      return {
        httpStatus: 503,
        payload: {
          isValid: false,
          status: 'SERVER_UNAVAILABLE',
          message: 'No se pudo consultar la licencia.',
          isPermanent: false,
          isExpired: false,
          expiryTimestamp: null,
          daysRemaining: null,
          planLabel: 'No disponible',
          error: 'LICENSE_STORAGE_UNAVAILABLE'
        }
      };
    }
    if (lookup.status === 'not_found') {
      return rejectedLicense('INVALID_SIGNATURE', 'La licencia no está registrada.');
    }

    const record = lookup.record;
    if (record.revoked) {
      return rejectedLicense('REVOKED', 'Esta licencia ha sido revocada o suspendida.', record.expiresAt, record.planLabel);
    }
    const registeredDevice = normalizeLicenseDeviceId(record.deviceId);
    if (registeredDevice !== 'ALL' && registeredDevice !== cleanDevice) {
      return rejectedLicense('INVALID_DEVICE', 'Esta licencia fue emitida para otro dispositivo.', record.expiresAt, record.planLabel);
    }
    expiresAt = record.expiresAt;
    if (expiresAt !== null && expiresAt <= Date.now()) {
      return rejectedLicense('EXPIRED', 'La licencia ha vencido.', expiresAt, record.planLabel);
    }
    planLabel = record.planLabel;
    planType = record.planType;
    resolvedClientName = record.clientName || record.clientNote || clientName;
    if (!await updateSupabaseLicenseActivity(key, clientName, deviceInfo)) {
      return {
        httpStatus: 503,
        payload: {
          isValid: false,
          status: 'SERVER_UNAVAILABLE',
          message: 'No se pudo guardar la actividad de la licencia.',
          isPermanent: false,
          isExpired: false,
          expiryTimestamp: expiresAt,
          daysRemaining: null,
          planLabel,
          error: 'LICENSE_STORAGE_UNAVAILABLE'
        }
      };
    }
    offlineClaims = {
      licenseKey: key,
      deviceId: cleanDevice,
      expiresAt,
      planType,
      planLabel,
      clientName: resolvedClientName
    };
  }

  const signingKeys = getLicenseSigningKeys();
  const offlineGrant = makeOfflineGrant(offlineClaims);
  if (!signingKeys || !offlineGrant) {
    return {
      httpStatus: 503,
      payload: {
        isValid: false,
        status: 'SERVER_UNAVAILABLE',
        message: 'La firma segura de licencias no está configurada.',
        isPermanent: false,
        isExpired: false,
        expiryTimestamp: expiresAt,
        daysRemaining: null,
        planLabel,
        error: 'LICENSE_SIGNING_UNAVAILABLE'
      }
    };
  }

  const now = Date.now();
  return {
    httpStatus: 200,
    payload: {
      isValid: true,
      status: 'ACTIVE',
      message: 'Licencia activa',
      isPermanent: expiresAt === null,
      isExpired: false,
      expiryTimestamp: expiresAt,
      daysRemaining: expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now) / 86400000)),
      planLabel,
      clientName: resolvedClientName,
      offlineGrant,
      licensePublicKey: signingKeys.publicKey
    }
  };
}

app.get('/api/admin/session', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminAuthConfigured()) {
    return res.status(503).json({
      authenticated: false,
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
      message: 'Configura ADMIN_PIN, ADMIN_SESSION_SECRET y SUPABASE_SERVICE_ROLE_KEY para habilitar el acceso administrativo.'
    });
  }
  const authenticated = isAdminSessionValid(req);
  return res.status(authenticated ? 200 : 401).json({
    authenticated,
    expiresAt: authenticated ? adminSessionExpiresAt(req) : null
  });
});

app.post('/api/admin/session', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ success: false, error: 'Origen de solicitud no permitido.' });
  }
  if (!isAdminAuthConfigured()) {
    return res.status(503).json({
      success: false,
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
      error: 'Configura ADMIN_PIN, ADMIN_SESSION_SECRET y SUPABASE_SERVICE_ROLE_KEY para habilitar el acceso administrativo.'
    });
  }

  const sessionSecret = getAdminSessionSecret();
  if (!sessionSecret) {
    return res.status(503).json({
      success: false,
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
      error: 'La autenticación administrativa no está configurada.'
    });
  }

  const ipHash = crypto
    .createHmac('sha256', sessionSecret)
    .update(req.ip || 'unknown')
    .digest('hex');
  let throttle: { blocked: boolean; retryAfterSeconds: number };
  try {
    throttle = await consumeAdminLoginAttempt(
      ipHash,
      ADMIN_LOGIN_MAX_ATTEMPTS,
      ADMIN_LOGIN_WINDOW_SECONDS
    );
  } catch (error) {
    console.error('[Admin Login Rate Limit Error]:', error);
    return res.status(503).json({
      success: false,
      code: 'ADMIN_RATE_LIMIT_UNAVAILABLE',
      error: 'No se pudo verificar el control de intentos. Verifica la conexión y la migración de Supabase.'
    });
  }

  if (throttle.blocked) {
    res.setHeader('Retry-After', String(throttle.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: 'ADMIN_LOGIN_RATE_LIMITED',
      error: 'Demasiados intentos. Espera antes de volver a intentarlo.'
    });
  }
  const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
  if (!safeEqual(pin, process.env.ADMIN_PIN || '')) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_ADMIN_CREDENTIALS',
      error: 'Credencial no válida.'
    });
  }

  try {
    await consumeAdminLoginAttempt(
      ipHash,
      ADMIN_LOGIN_MAX_ATTEMPTS,
      ADMIN_LOGIN_WINDOW_SECONDS,
      true
    );
  } catch (error) {
    console.error('[Admin Login Rate Limit Reset Error]:', error);
    return res.status(503).json({
      success: false,
      code: 'ADMIN_RATE_LIMIT_UNAVAILABLE',
      error: 'No se pudo completar el inicio seguro. Verifica la conexión a Supabase y vuelve a intentar.'
    });
  }

  setAdminSessionCookie(res);
  return res.json({ success: true, expiresAt: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000 });
});

app.delete('/api/admin/session', (req, res) => {
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ success: false, error: 'Origen de solicitud no permitido.' });
  }
  clearAdminSessionCookie(res);
  return res.json({ success: true });
});

// 1. Obtener configuración pública de contacto (WhatsApp) y logo para la app
app.get('/api/license/config', (req, res) => {
  const cfg = getAdminConfig();

  return res.json({
    success: true,
    adminWhatsApp: cfg.adminWhatsApp,
    supportName: cfg.supportName,
    customLogoUrl: cfg.customLogoUrl,
    colorTheme: cfg.colorTheme || 'cyan-emerald',
    requiresAuth: true
  });
});

// 2. Actualizar configuración de contacto (protegido por sesión administrativa)
app.post('/api/license/config', requireAdminSession, (req, res) => {
  const { adminWhatsApp, supportName, customLogoUrl, colorTheme } = req.body || {};
  const currentCfg = getAdminConfig();

  if (adminWhatsApp && typeof adminWhatsApp === 'string') {
    currentCfg.adminWhatsApp = adminWhatsApp.replace(/[^0-9]/g, '');
  }
  if (supportName && typeof supportName === 'string') {
    currentCfg.supportName = supportName.trim();
  }
  if (typeof customLogoUrl === 'string' || customLogoUrl === null) {
    currentCfg.customLogoUrl = customLogoUrl || undefined;
  }
  if (typeof colorTheme === 'string') {
    currentCfg.colorTheme = colorTheme;
  }

  saveAdminConfig(currentCfg);
  return res.json({
    success: true,
    message: 'Configuración actualizada con éxito',
    config: {
      adminWhatsApp: currentCfg.adminWhatsApp,
      supportName: currentCfg.supportName,
      customLogoUrl: currentCfg.customLogoUrl,
      colorTheme: currentCfg.colorTheme
    }
  });
});

app.get('/api/license/public-key', (_req, res) => {
  const keys = getLicenseSigningKeys();
  if (!keys) {
    return res.status(503).json({ success: false, error: 'La firma de licencias no está configurada.' });
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.json({ success: true, publicKey: keys.publicKey });
});

// 3. Generar una nueva licencia (protegido por sesión administrativa)
app.post('/api/license/generate', requireAdminSession, async (req, res) => {
  const { deviceId, clientNote, planType = '30D', customExpiryMs } = req.body || {};

  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 4) {
    return res.status(400).json({ success: false, error: 'Código de dispositivo no válido' });
  }
  const supportedPlans = ['24H', '7D', '15D', '30D', '90D', 'PERMANENT', 'CUSTOM'];
  if (typeof planType !== 'string' || !supportedPlans.includes(planType)) {
    return res.status(400).json({ success: false, error: 'El plan solicitado no es válido.' });
  }
  if (planType === 'CUSTOM' && (!Number.isFinite(Number(customExpiryMs)) || Number(customExpiryMs) <= Date.now())) {
    return res.status(400).json({ success: false, error: 'La fecha de vencimiento personalizada no es válida.' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ success: false, error: 'Supabase es obligatorio para guardar licencias.' });
  }

  const { key, expiresAt, planLabel } = serverGenerateToken(deviceId.trim(), planType, customExpiryMs);

  const record: ServerLicenseRecord = {
    id: `LIC-${crypto.randomUUID()}`,
    key,
    deviceId: deviceId.trim().toUpperCase(),
    clientNote: clientNote ? String(clientNote).trim() : undefined,
    clientName: clientNote ? String(clientNote).trim() : undefined,
    planType,
    planLabel,
    createdAt: Date.now(),
    expiresAt,
    lastActiveTimestamp: Date.now(),
    revoked: false
  };

  if (!await upsertSupabaseLicense(record)) {
    return res.status(503).json({
      success: false,
      error: 'No se pudo guardar la licencia en Supabase; no se generó una clave utilizable.'
    });
  }

  const formattedDate = expiresAt ? new Date(expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Permanente (Sin Vencimiento)';
  const whatsappReply = `🔥 *SportStats Pro - Acceso Autorizado*\n\nHola! Tu acceso a la plataforma *SportStats Pro* ha sido activado con éxito.\n📌 *Plan:* ${planLabel}\n⏳ *Vigencia:* ${formattedDate}\n🔑 *Tu Clave de Acceso:*\n${key}\n\n*Instrucciones:*\n1. Abre la aplicación.\n2. Pega tu clave de acceso en la casilla.\n3. Presiona "Ingresar a SportStats Pro". ¡Listo!`;

  return res.json({
    success: true,
    record,
    whatsappReply
  });
});

// 3b. Ping de Presencia Silencioso (Heartbeat en tiempo real)
app.post('/api/license/heartbeat', async (req, res) => {
  const { key, deviceId, clientName, deviceInfo } = req.body || {};
  if (typeof key !== 'string' || !key || typeof deviceId !== 'string' || !deviceId) {
    return res.status(400).json({ success: false, error: 'Faltan la credencial y el dispositivo.' });
  }

  const validation = await validateLicenseAccess(
    key.trim(),
    deviceId.trim(),
    typeof clientName === 'string' ? clientName.trim() : undefined,
    typeof deviceInfo === 'string' ? deviceInfo.trim() : undefined
  );
  if (!validation.payload.isValid) {
    return res.status(validation.httpStatus).json({
      success: false,
      ...validation.payload,
      revoked: validation.payload.status === 'REVOKED'
    });
  }
  return res.json({
    success: true,
    ...validation.payload,
    revoked: false,
    isExpired: false
  });
});

// 4. Validar una licencia pública con comprobación de revocación
app.post('/api/license/validate', async (req, res) => {
  const { key, deviceId, clientName, deviceInfo } = req.body || {};
  if (typeof key !== 'string' || !key.trim() || typeof deviceId !== 'string' || !deviceId.trim()) {
    return res.status(400).json({ isValid: false, error: 'Se requieren la clave y el dispositivo.' });
  }

  const validation = await validateLicenseAccess(
    key.trim(),
    deviceId.trim(),
    typeof clientName === 'string' ? clientName.trim() : undefined,
    typeof deviceInfo === 'string' ? deviceInfo.trim() : undefined
  );
  return res.status(validation.httpStatus).json(validation.payload);
});

// 5. Listar licencias emitidas con información de presencia y días
app.get('/api/license/list', requireAdminSession, async (_req, res) => {
  const list = await fetchSupabaseLicenses();
  if (!list) {
    return res.status(503).json({ success: false, error: 'No se pudieron consultar las licencias en Supabase.' });
  }
  const nowMs = Date.now();

  const enriched = list.map(item => {
    const isOnline = item.lastActiveTimestamp ? (nowMs - item.lastActiveTimestamp) < (3 * 60 * 1000) : false;
    const daysRemaining = item.expiresAt ? Math.max(0, Math.ceil((item.expiresAt - nowMs) / (24 * 60 * 60 * 1000))) : null;
    const isExpired = item.expiresAt ? item.expiresAt < nowMs : false;

    return {
      ...item,
      isOnline,
      daysRemaining,
      isExpired
    };
  });

  return res.json({
    success: true,
    licenses: enriched
  });
});

// 5b. Renovación a 1-Clic de Acceso (+15, +30, +90 días)
app.post('/api/license/renew', requireAdminSession, async (req, res) => {
  const { key, deviceId, addDays = 30 } = req.body || {};
  const cleanKey = key ? String(key).trim().toUpperCase() : '';
  const cleanDev = deviceId ? String(deviceId).trim().toUpperCase() : '';
  const days = Number(addDays);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    return res.status(400).json({ success: false, error: 'La cantidad de días debe estar entre 1 y 3650.' });
  }

  let record: ServerLicenseRecord | undefined;
  if (cleanKey) {
    const lookup = await lookupSupabaseLicense(cleanKey);
    if (lookup.status === 'unavailable') {
      return res.status(503).json({ success: false, error: 'No se pudo consultar la licencia en Supabase.' });
    }
    if (lookup.status === 'found') record = lookup.record;
  } else if (cleanDev) {
    const records = await fetchSupabaseLicenses();
    if (!records) {
      return res.status(503).json({ success: false, error: 'No se pudieron consultar las licencias en Supabase.' });
    }
    record = records.find((item) => item.deviceId.toUpperCase() === cleanDev);
  }
  if (!record) {
    return res.status(404).json({ success: false, error: 'No se encontró el registro de la licencia' });
  }

  const nowMs = Date.now();
  const daysToAddMs = days * 24 * 60 * 60 * 1000;

  // Si ya estaba vencida o sin vencimiento previo
  if (!record.expiresAt || record.expiresAt < nowMs) {
    record.expiresAt = nowMs + daysToAddMs;
  } else {
    record.expiresAt += daysToAddMs;
  }

  record.revoked = false; // Al renovar, se reactiva automáticamente
  record.planLabel = `Extensión +${days} Días`;
  if (!await updateSupabaseLicense(record)) {
    return res.status(503).json({ success: false, error: 'No se pudo guardar la renovación en Supabase.' });
  }

  const formattedDate = new Date(record.expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  return res.json({
    success: true,
    message: `Acceso renovado exitosamente por +${days} días (Nuevo vencimiento: ${formattedDate})`,
    record
  });
});

// 5c. Estado de Supabase y esquema SQL para el administrador
app.use('/api/admin', requireAdminSession);

app.get('/api/admin/supabase-status', (req, res) => {

  const isConfigured = isSupabaseConfigured();
  const rawUrl = process.env.SUPABASE_URL || '';
  const maskedUrl = rawUrl ? rawUrl.replace(/^https?:\/\//, '').split('.')[0] + '.supabase.co' : null;

  return res.json({
    success: true,
    configured: isConfigured,
    adminLoginThrottleConfigured: isAdminLoginThrottleConfigured(),
    supabaseProject: maskedUrl,
    sqlSchema: SUPABASE_SQL_SCHEMA
  });
});

// 6. Revocar o reactivar licencia
app.post('/api/license/revoke', requireAdminSession, async (req, res) => {
  const { key, revoke = true } = req.body || {};
  if (typeof key !== 'string' || !key.trim()) {
    return res.status(400).json({ success: false, updated: false, error: 'La clave de licencia no es válida.' });
  }
  const lookup = await lookupSupabaseLicense(key.trim().toUpperCase());
  if (lookup.status === 'unavailable') {
    return res.status(503).json({ success: false, updated: false, error: 'No se pudo consultar la licencia en Supabase.' });
  }
  if (lookup.status === 'not_found') {
    return res.status(404).json({ success: false, updated: false, error: 'No se encontró la licencia.' });
  }
  const updated = await updateSupabaseLicense({ ...lookup.record, revoked: Boolean(revoke) });
  if (!updated) {
    return res.status(503).json({ success: false, updated: false, error: 'No se pudo guardar el cambio en Supabase.' });
  }
  return res.json({ success: true, message: revoke ? 'Licencia revocada' : 'Licencia reactivada', updated });
});

// 7. Guardar logo personalizado de la app e iconos instalables PWA (Android / iOS / Chrome)
app.post('/api/admin/logo', (req, res) => {
  const { imageData, pwa512, pwa192, pwaMaskable } = req.body || {};
  const cfg = getAdminConfig();

  if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
    return res.status(400).json({ success: false, error: 'Formato de imagen inválido' });
  }

  const saveBase64File = (dataUrl: string, targetFile: string) => {
    const m = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (m && m.length === 3) {
      const buf = Buffer.from(m[2], 'base64');
      fs.writeFileSync(path.resolve(__dirname, 'public', targetFile), buf);
    }
  };

  try {
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: 'Datos de imagen corruptos' });
    }

    const ext = matches[1].includes('jpeg') || matches[1].includes('jpg') ? 'jpg' : 'png';
    const filename = `custom-logo.${ext}`;
    saveBase64File(imageData, filename);

    // Actualizar automáticamente los iconos instalables de Google Chrome / Android / iPhone (PWA)
    saveBase64File(pwa512 || imageData, 'pwa-512x512.png');
    saveBase64File(pwa192 || imageData, 'pwa-192x192.png');
    saveBase64File(pwa192 || imageData, 'apple-touch-icon.png');
    saveBase64File(pwaMaskable || pwa512 || imageData, 'pwa-maskable-512x512.png');

    const logoUrl = `/${filename}?t=${Date.now()}`;

    cfg.customLogoUrl = logoUrl;
    saveAdminConfig(cfg);

    return res.json({ success: true, logoUrl, message: 'Logo e icono móvil de Chrome/iPhone actualizados con éxito' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Error al procesar y guardar la imagen: ' + err.message });
  }
});

// 8. Restaurar logo por defecto
app.delete('/api/admin/logo', (req, res) => {
  const cfg = getAdminConfig();

  try {
    cfg.customLogoUrl = undefined;
    saveAdminConfig(cfg);

    // Try deleting custom-logo files if present
    ['custom-logo.png', 'custom-logo.jpg'].forEach(f => {
      const p = path.resolve(__dirname, 'public', f);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
      }
    });

    return res.json({ success: true, message: 'Logo restaurado al predeterminado' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// RUTAS DE AUTENTICACIÓN Y CONTROL DE DISPOSITIVO ÚNICO
// =========================================================================

// 1. Iniciar Sesión con Usuario + PIN (con verificación de Dispositivo Único)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, pin, deviceId, deviceName } = req.body || {};
    if (String(username || '').trim().toLowerCase() === 'admin') {
      return res.status(403).json({
        success: false,
        code: 'ADMIN_LOGIN_REQUIRED',
        message: 'El administrador debe ingresar desde el panel administrativo.'
      });
    }
    if (typeof deviceId !== 'string' || normalizeLicenseDeviceId(deviceId).length < 8) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_DEVICE',
        message: 'No se pudo identificar este dispositivo. Recarga la aplicación e intenta de nuevo.'
      });
    }

    const throttleConfigured = isClientLoginThrottleConfigured();
    const throttleRequired = process.env.NODE_ENV === 'production' || IS_VERCEL;
    if (throttleRequired && !throttleConfigured) {
      return res.status(503).json({
        success: false,
        code: 'CLIENT_LOGIN_RATE_LIMIT_UNAVAILABLE',
        message: 'El control seguro de intentos no está configurado. Contacta al administrador.'
      });
    }

    let loginKeyHash: string | null = null;
    if (throttleConfigured) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!serviceRoleKey) {
        return res.status(503).json({
          success: false,
          code: 'CLIENT_LOGIN_RATE_LIMIT_UNAVAILABLE',
          message: 'El control seguro de intentos no está configurado. Contacta al administrador.'
        });
      }

      loginKeyHash = crypto
        .createHmac('sha256', serviceRoleKey)
        .update(`client-login:${req.ip || 'unknown'}:${normalizeUsername(String(username || ''))}`)
        .digest('hex');

      let throttle: { blocked: boolean; retryAfterSeconds: number };
      try {
        throttle = await consumeClientLoginAttempt(
          loginKeyHash,
          CLIENT_LOGIN_MAX_ATTEMPTS,
          CLIENT_LOGIN_WINDOW_SECONDS
        );
      } catch (error) {
        console.error('[Client Login Rate Limit Error]:', error);
        return res.status(503).json({
          success: false,
          code: 'CLIENT_LOGIN_RATE_LIMIT_UNAVAILABLE',
          message: 'No se pudo verificar el control de intentos. Intenta de nuevo más tarde.'
        });
      }

      if (throttle.blocked) {
        res.setHeader('Retry-After', String(throttle.retryAfterSeconds));
        return res.status(429).json({
          success: false,
          code: 'CLIENT_LOGIN_RATE_LIMITED',
          message: 'Demasiados intentos para este usuario desde esta red. Espera antes de volver a intentarlo.'
        });
      }
    }

    const result = await loginAppUser(username, pin, deviceId, deviceName);
    let accountCredential: string | null = null;
    if (result.success && result.user) {
      const accountLookup = await fetchSupabaseLicenseAccount(result.user.id);
      if (accountLookup.status !== 'found') {
        return res.status(503).json({
          success: false,
          code: 'LICENSE_STORAGE_UNAVAILABLE',
          message: 'No se pudo confirmar la cuenta en Supabase. Intenta de nuevo más tarde.'
        });
      }
      const account = accountLookup.account;
      if (
        account.role !== 'client' ||
        account.status !== 'active' ||
        normalizeLicenseDeviceId(account.boundDeviceId || '') !== normalizeLicenseDeviceId(String(deviceId || '')) ||
        (account.expiresAt !== null && account.expiresAt <= Date.now())
      ) {
        return res.status(403).json({
          success: false,
          code: 'LICENSE_NOT_ACTIVE',
          message: 'La cuenta no tiene una licencia activa para este dispositivo.'
        });
      }
      accountCredential = signLicenseToken('SA1', {
        type: 'account',
        userId: account.id,
        deviceId: normalizeLicenseDeviceId(String(deviceId || '')),
        issuedAt: Date.now(),
        expiresAt: account.expiresAt,
        planType: account.planType,
        planLabel: account.planLabel,
        clientName: account.displayName || account.username
      });
      if (!accountCredential) {
        return res.status(503).json({
          success: false,
          code: 'LICENSE_SIGNING_UNAVAILABLE',
          message: 'No se pudo emitir una credencial segura. Contacta al administrador.'
        });
      }
    }
    if (result.success && loginKeyHash) {
      try {
        await consumeClientLoginAttempt(
          loginKeyHash,
          CLIENT_LOGIN_MAX_ATTEMPTS,
          CLIENT_LOGIN_WINDOW_SECONDS,
          true
        );
      } catch (error) {
        console.error('[Client Login Rate Limit Reset Error]:', error);
        return res.status(503).json({
          success: false,
          code: 'CLIENT_LOGIN_RATE_LIMIT_UNAVAILABLE',
          message: 'No se pudo completar el inicio seguro. Intenta de nuevo más tarde.'
        });
      }
    }
    return res.json({ ...result, ...(accountCredential ? { accountCredential } : {}) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error en inicio de sesión' });
  }
});

// 2. Solicitar Registro de Cuenta Nueva (Usuario + PIN)
app.post('/api/auth/register-request', async (req, res) => {
  try {
    const { username, pin, displayName, whatsapp } = req.body || {};
    const result = await registerAppUserRequest(username, pin, displayName, whatsapp);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error al procesar solicitud' });
  }
});

// 3. Listar Usuarios Registrados (Solo Administrador)
app.get('/api/admin/users/list', async (req, res) => {
  try {
    const users = await adminListAppUsers();
    return res.json({ success: true, users });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Desvincular Dispositivo de Usuario (Para cambio legítimo de teléfono)
app.post('/api/admin/users/reset-device', async (req, res) => {
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ success: false, error: 'ID de usuario requerido' });
  }

  const ok = await adminResetAppUserDevice(userId);
  return res.json({
    success: ok,
    message: ok
      ? 'Dispositivo desvinculado con éxito. El usuario ahora puede ingresar desde su nuevo equipo.'
      : 'No se pudo desvincular el dispositivo.'
  });
});

// 5. Renovar / Extender Suscripción a Usuario (+15, +30, +90 días)
app.post('/api/admin/users/renew', async (req, res) => {
  const { userId, addDays = 30 } = req.body || {};

  if (!userId) {
    return res.status(400).json({ success: false, error: 'ID de usuario requerido' });
  }

  const ok = await adminRenewAppUser(userId, Number(addDays));
  return res.json({ success: ok, message: ok ? `Suscripción extendida +${addDays} días` : 'Error al renovar' });
});

// 6. Cambiar Estado de Usuario (active / suspended)
app.post('/api/admin/users/toggle-status', async (req, res) => {
  const { userId, status } = req.body || {};

  const ok = await adminToggleAppUserStatus(userId, status === 'suspended' ? 'suspended' : 'active');
  return res.json({ success: ok, message: ok ? 'Estado actualizado' : 'Error al cambiar estado' });
});

// 7. Crear o Editar Usuario Manualmente
app.post('/api/admin/users/upsert', async (req, res) => {
  const { user } = req.body || {};

  const ok = await adminUpsertAppUser(user);
  return res.json({ success: ok, message: ok ? 'Usuario guardado' : 'Error al guardar usuario' });
});

// Serve public assets (images, wallpapers, icons) without caching
app.use(express.static(path.resolve(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Middleware global de captura de errores para Express (activo tanto en desarrollo como en producción Vercel)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express Error Handler]:', err);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err?.message || 'Error interno en el servidor'
    });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !IS_VERCEL) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`FutbolStats Pro server listening on port ${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('[Server Listen Error]:', err);
  });
}

if (!IS_VERCEL) {
  startServer().catch((err) => {
    console.error('[Fatal Error Starting Server]:', err);
  });
}

export default app;
