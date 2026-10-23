import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let supabaseClient: SupabaseClient | null = null;

const IS_VERCEL = Boolean(process.env.VERCEL);
const LOCAL_USERS_FILE = IS_VERCEL
  ? path.resolve('/tmp', 'sportstats_users_db.json')
  : path.resolve(process.cwd(), 'sportstats_users_db.json');

interface StoredAppUser extends AppUser {
  pinHash: string;
  legacyPin?: string;
}

let memoryUsersCache: StoredAppUser[] | null = null;

function getLocalUsersDb(): StoredAppUser[] {
  if (memoryUsersCache) return memoryUsersCache;
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const raw = fs.readFileSync(LOCAL_USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryUsersCache = parsed.map((entry) => {
          const { pin, pin_hash: pinHashSnake, ...user } = entry;
          const pinHash = typeof entry.pinHash === 'string'
            ? entry.pinHash
            : typeof pinHashSnake === 'string'
              ? pinHashSnake
              : typeof pin === 'string' && isPinHash(pin)
                ? pin
                : '';
          return {
            ...user,
            pinHash,
            ...(typeof pin === 'string' && !isPinHash(pin) ? { legacyPin: pin } : {})
          } as StoredAppUser;
        });
        return memoryUsersCache;
      }
    }
  } catch {
    // ignore read error
  }
  memoryUsersCache = [];
  return memoryUsersCache;
}

function saveLocalUsersDb(users: StoredAppUser[]): boolean {
  memoryUsersCache = users;
  try {
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

const PIN_HASH_PREFIX = 'scrypt$';
const PIN_SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function isPinHash(value: string): boolean {
  return value.startsWith(PIN_HASH_PREFIX);
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(pin, salt, 64, PIN_SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
  return `${PIN_HASH_PREFIX}${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPin(pin: string, storedValue: string): Promise<{ valid: boolean; upgradedHash?: string }> {
  if (!isPinHash(storedValue)) {
    const valid = safePinEqual(pin, storedValue);
    return valid ? { valid, upgradedHash: await hashPin(pin) } : { valid };
  }

  const [, saltHex, hashHex, extra] = storedValue.split('$');
  if (!saltHex || !hashHex || extra || !/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(hashHex)) {
    return { valid: false };
  }
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(pin, Buffer.from(saltHex, 'hex'), expected.length, PIN_SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
  return { valid: crypto.timingSafeEqual(actual, expected) };
}

function safePinEqual(left: string, right: string): boolean {
  const leftDigest = crypto.createHash('sha256').update(left).digest();
  const rightDigest = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

async function migrateLegacyLocalPins(users: StoredAppUser[]): Promise<void> {
  let changed = false;
  for (const user of users) {
    if (user.legacyPin === undefined) continue;
    user.pinHash = await hashPin(user.legacyPin);
    delete user.legacyPin;
    changed = true;
  }
  if (changed && !saveLocalUsersDb(users)) {
    throw new Error('Could not persist the migrated client PIN hashes to local storage.');
  }
}

export function normalizeSupabaseUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  let clean = rawUrl.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}.supabase.co`;
  }
  return clean.replace(/\/$/, '');
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const rawUrl = process.env.SUPABASE_URL?.trim();
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log('[Supabase] Cliente conectado exitosamente a:', url);
    } catch (err) {
      console.error('[Supabase] Error al inicializar cliente:', err);
      supabaseClient = null;
    }
  }

  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const url = normalizeSupabaseUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  return Boolean(url && key);
}

export function isAdminLoginThrottleConfigured(): boolean {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  return Boolean(url && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function consumeAdminLoginAttempt(
  ipHash: string,
  maxAttempts: number,
  windowSeconds: number,
  reset = false
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  if (!isAdminLoginThrottleConfigured()) {
    throw new Error('Supabase service-role credentials are required for administrator login throttling.');
  }

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client is unavailable for administrator login throttling.');
  }

  const { data, error } = await client.rpc('sportstats_consume_admin_login_attempt', {
    p_ip_hash: ipHash,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
    p_reset: reset
  });

  if (error) {
    throw new Error(`Supabase administrator login throttling failed: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : null;
  if (
    !result ||
    typeof result.blocked !== 'boolean' ||
    !Number.isFinite(Number(result.retry_after_seconds))
  ) {
    throw new Error('Supabase returned an invalid administrator login throttle response.');
  }

  return {
    blocked: result.blocked,
    retryAfterSeconds: Number(result.retry_after_seconds)
  };
}

export function isClientLoginThrottleConfigured(): boolean {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  return Boolean(url && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function consumeClientLoginAttempt(
  loginKeyHash: string,
  maxAttempts: number,
  windowSeconds: number,
  reset = false
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  if (!isClientLoginThrottleConfigured()) {
    throw new Error('Supabase service-role credentials are required for client login throttling.');
  }

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client is unavailable for client login throttling.');
  }

  const { data, error } = await client.rpc('sportstats_consume_client_login_attempt', {
    p_login_key_hash: loginKeyHash,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
    p_reset: reset
  });

  if (error) {
    throw new Error(`Supabase client login throttling failed: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : null;
  if (
    !result ||
    typeof result.blocked !== 'boolean' ||
    !Number.isFinite(Number(result.retry_after_seconds))
  ) {
    throw new Error('Supabase returned an invalid client login throttle response.');
  }

  return {
    blocked: result.blocked,
    retryAfterSeconds: Number(result.retry_after_seconds)
  };
}

export interface AdminConfig {
  adminWhatsApp: string;
  supportName?: string;
  customLogoUrl?: string;
  colorTheme?: string;
}

export interface ServerLicenseRecord {
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

export type SupabaseLicenseLookup =
  | { status: 'found'; record: ServerLicenseRecord }
  | { status: 'not_found' }
  | { status: 'unavailable' };

export interface SupabaseLicenseAccount {
  id: string;
  status: string;
  role: string;
  planType: string;
  planLabel: string;
  expiresAt: number | null;
  boundDeviceId: string | null;
  displayName?: string;
  username: string;
}

function mapSupabaseLicense(row: any): ServerLicenseRecord {
  return {
    id: row.id,
    key: row.key,
    deviceId: row.device_id,
    clientNote: row.client_note || undefined,
    clientName: row.client_name || undefined,
    planType: row.plan_type,
    planLabel: row.plan_label,
    createdAt: Number(row.created_at),
    expiresAt: row.expires_at === null ? null : Number(row.expires_at),
    lastActiveTimestamp: row.last_active_timestamp ? Number(row.last_active_timestamp) : undefined,
    deviceInfo: row.device_info || undefined,
    revoked: Boolean(row.revoked),
  };
}

// 1. Configuración de Administrador
export async function fetchSupabaseAdminConfig(): Promise<AdminConfig | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('sportstats_config')
      .select('admin_whatsapp, support_name, custom_logo_url, color_theme')
      .eq('id', 'main')
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Config] Advertencia al leer configuración:', error.message);
      return null;
    }

    if (data) {
      return {
        adminWhatsApp: data.admin_whatsapp,
        supportName: data.support_name || undefined,
        customLogoUrl: data.custom_logo_url || undefined,
        colorTheme: data.color_theme || 'cyan-emerald',
      };
    }
  } catch (err) {
    console.error('[Supabase Config] Excepción:', err);
  }
  return null;
}

export async function upsertSupabaseAdminConfig(cfg: AdminConfig): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('sportstats_config').upsert({
      id: 'main',
      admin_whatsapp: cfg.adminWhatsApp,
      support_name: cfg.supportName || null,
      custom_logo_url: cfg.customLogoUrl || null,
      color_theme: cfg.colorTheme || 'cyan-emerald',
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('[Supabase Config] Error al guardar configuración:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase Config] Excepción al guardar:', err);
    return false;
  }
}

// 2. Licencias en Supabase
export async function fetchSupabaseLicenses(): Promise<ServerLicenseRecord[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('sportstats_licenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase Licenses] Error al consultar licencias:', error.message);
      return null;
    }

    if (Array.isArray(data)) {
      return data.map(mapSupabaseLicense);
    }
  } catch (err) {
    console.error('[Supabase Licenses] Excepción:', err);
  }
  return null;
}

export async function lookupSupabaseLicense(key: string): Promise<SupabaseLicenseLookup> {
  const client = getSupabaseClient();
  if (!client) return { status: 'unavailable' };

  try {
    const { data, error } = await client
      .from('sportstats_licenses')
      .select('*')
      .eq('key', key)
      .maybeSingle();
    if (error) {
      console.error('[Supabase License Lookup] Error:', error.message);
      return { status: 'unavailable' };
    }
    return data
      ? { status: 'found', record: mapSupabaseLicense(data) }
      : { status: 'not_found' };
  } catch (error) {
    console.error('[Supabase License Lookup] Exception:', error);
    return { status: 'unavailable' };
  }
}

export async function fetchSupabaseLicenseAccount(userId: string): Promise<
  { status: 'found'; account: SupabaseLicenseAccount } | { status: 'not_found' } | { status: 'unavailable' }
> {
  const client = getSupabaseClient();
  if (!client) return { status: 'unavailable' };

  try {
    const { data, error } = await client
      .from('sportstats_users')
      .select('id, username, display_name, role, status, plan_type, plan_label, expires_at, bound_device_id')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('[Supabase License Account Lookup] Error:', error.message);
      return { status: 'unavailable' };
    }
    if (!data) return { status: 'not_found' };

    return {
      status: 'found',
      account: {
        id: data.id,
        username: data.username,
        displayName: data.display_name || undefined,
        role: data.role,
        status: data.status,
        planType: data.plan_type || '30D',
        planLabel: data.plan_label || 'Pase Activo',
        expiresAt: data.expires_at === null ? null : Number(data.expires_at),
        boundDeviceId: data.bound_device_id || null,
      }
    };
  } catch (error) {
    console.error('[Supabase License Account Lookup] Exception:', error);
    return { status: 'unavailable' };
  }
}

export async function upsertSupabaseLicense(record: ServerLicenseRecord): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('sportstats_licenses').upsert(
      {
        id: record.id,
        key: record.key,
        device_id: record.deviceId,
        client_note: record.clientNote || null,
        client_name: record.clientName || null,
        plan_type: record.planType,
        plan_label: record.planLabel,
        created_at: record.createdAt,
        expires_at: record.expiresAt,
        last_active_timestamp: record.lastActiveTimestamp || null,
        device_info: record.deviceInfo || null,
        revoked: record.revoked,
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.warn('[Supabase License] Error al guardar licencia:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase License] Excepción al guardar:', err);
    return false;
  }
}

export async function updateSupabaseUserLicenseActivity(userId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client
      .from('sportstats_users')
      .update({ last_active_at: Date.now() })
      .eq('id', userId)
      .select('id');
    if (error) {
      console.error('[Supabase User License Activity] Error:', error.message);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    console.error('[Supabase User License Activity] Exception:', error);
    return false;
  }
}

export async function updateSupabaseLicense(record: ServerLicenseRecord): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client
      .from('sportstats_licenses')
      .update({
        expires_at: record.expiresAt,
        plan_label: record.planLabel,
        revoked: record.revoked,
        last_active_timestamp: record.lastActiveTimestamp || null,
        client_name: record.clientName || null,
        device_info: record.deviceInfo || null,
      })
      .eq('key', record.key)
      .select('key');
    if (error) {
      console.error('[Supabase License Update] Error:', error.message);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    console.error('[Supabase License Update] Exception:', error);
    return false;
  }
}

export async function updateSupabaseLicenseActivity(
  key: string,
  clientName?: string,
  deviceInfo?: string
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client
      .from('sportstats_licenses')
      .update({
        last_active_timestamp: Date.now(),
        ...(clientName ? { client_name: clientName } : {}),
        ...(deviceInfo ? { device_info: deviceInfo } : {}),
      })
      .eq('key', key)
      .select('key');
    if (error) {
      console.error('[Supabase License Activity] Error:', error.message);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (error) {
    console.error('[Supabase License Activity] Exception:', error);
    return false;
  }
}

// 3. Sistema Seguro de Recuperación OTP (Un solo uso, 15 min de vigencia, sin exponerse en frontend)
export interface RecoveryOtpResult {
  requestId: string;
  otp: string;
  expiresAt: number;
}

export async function createSecureRecoveryOtp(deviceId: string): Promise<RecoveryOtpResult> {
  const otpNumber = crypto.randomInt(100000, 999999).toString();
  const requestId = `REC-${Date.now().toString(36).toUpperCase()}`;
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('sportstats_recovery_requests').insert({
        id: requestId,
        device_id: deviceId.toUpperCase(),
        otp_code: otpNumber,
        expires_at: expiresAt,
        used: false,
      });
    } catch (err) {
      console.warn('[Supabase OTP] No se pudo guardar en Supabase, fallback en memoria:', err);
    }
  }

  return { requestId, otp: otpNumber, expiresAt };
}

export async function verifyAndConsumeRecoveryOtp(deviceId: string, otpInput: string): Promise<boolean> {
  const client = getSupabaseClient();
  const cleanDev = deviceId.trim().toUpperCase();
  const cleanOtp = otpInput.trim();

  if (client) {
    try {
      const { data, error } = await client
        .from('sportstats_recovery_requests')
        .select('*')
        .eq('device_id', cleanDev)
        .eq('otp_code', cleanOtp)
        .eq('used', false)
        .gt('expires_at', Date.now())
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        await client
          .from('sportstats_recovery_requests')
          .update({ used: true })
          .eq('id', data[0].id);
        return true;
      }
    } catch (err) {
      console.error('[Supabase OTP Verify] Excepción:', err);
    }
  }

  return false;
}

// =========================================================================
// GESTIÓN DE USUARIOS Y CONTROL DE DISPOSITIVO ÚNICO (SINGLE DEVICE LOCK)
// =========================================================================

export interface AppUser {
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

export function normalizeUsername(input: string): string {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

export interface LoginResult {
  success: boolean;
  code?: 'USER_NOT_FOUND' | 'INVALID_PIN' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'EXPIRED' | 'DEVICE_LOCKED' | 'SERVER_ERROR';
  message: string;
  user?: AppUser;
  boundDeviceName?: string | null;
  whatsappContact?: string;
}

export async function loginAppUser(
  rawUsername: string,
  rawPin: string,
  deviceId: string,
  deviceName?: string
): Promise<LoginResult> {
  const username = normalizeUsername(rawUsername);
  const pin = String(rawPin || '').trim();
  const cleanDevice = String(deviceId || '').trim().toUpperCase();
  const friendlyDevName = String(deviceName || 'Dispositivo Web / Móvil').trim();

  if (!username || username.length < 3) {
    return {
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'El nombre de usuario debe tener entre 3 y 20 caracteres (solo letras y números).'
    };
  }

  if (!pin) {
    return {
      success: false,
      code: 'INVALID_PIN',
      message: 'Por favor ingresa tu PIN de acceso.'
    };
  }

  const client = getSupabaseClient();
  const nowMs = Date.now();

  if (client) {
    try {
      const { data, error } = await client
        .from('sportstats_users')
        .select('id, username, display_name, pin_hash, role, status, plan_type, plan_label, created_at, expires_at, bound_device_id, bound_device_name, bound_device_updated_at, last_active_at, whatsapp_number, notes')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        console.warn('[Supabase User Login] Error:', error.message);
      }

      if (data) {
        const pinCheck = await verifyPin(pin, String(data.pin_hash || ''));
        if (!pinCheck.valid) {
          return {
            success: false,
            code: 'INVALID_PIN',
            message: 'El PIN ingresado no es correcto para este usuario.'
          };
        }

        if (pinCheck.upgradedHash) {
          const { error: migrationError } = await client
            .from('sportstats_users')
            .update({ pin_hash: pinCheck.upgradedHash })
            .eq('id', data.id);
          if (migrationError) {
            console.error('[Supabase Client PIN Migration Error]:', migrationError.message);
            return {
              success: false,
              code: 'SERVER_ERROR',
              message: 'No se pudo proteger el PIN de esta cuenta. Intenta de nuevo más tarde.'
            };
          }
        }

        if (data.role === 'admin') {
          return {
            success: false,
            code: 'INVALID_PIN',
            message: 'El administrador debe ingresar desde el panel administrativo.'
          };
        }

        if (data.status === 'pending') {
          return {
            success: false,
            code: 'PENDING_APPROVAL',
            message: 'Tu cuenta está pendiente de activación por el administrador.'
          };
        }

        if (data.status === 'suspended') {
          return {
            success: false,
            code: 'SUSPENDED',
            message: 'Tu cuenta ha sido suspendida. Contacta al administrador.'
          };
        }

        if (data.expires_at && data.expires_at < nowMs) {
          return {
            success: false,
            code: 'EXPIRED',
            message: 'Tu plan de acceso ha vencido. Contacta al administrador para renovar.'
          };
        }

        if (!data.bound_device_id) {
          await client
            .from('sportstats_users')
            .update({
              bound_device_id: cleanDevice,
              bound_device_name: friendlyDevName,
              bound_device_updated_at: new Date().toISOString(),
              last_active_at: nowMs
            })
            .eq('id', data.id);

          data.bound_device_id = cleanDevice;
          data.bound_device_name = friendlyDevName;
        } else if (data.bound_device_id !== cleanDevice) {
          return {
            success: false,
            code: 'DEVICE_LOCKED',
            boundDeviceName: data.bound_device_name || 'Dispositivo Principal',
            message: `Esta cuenta ya está vinculada a otro dispositivo (${data.bound_device_name || 'dispositivo principal'}). Para cambiar de equipo solicita la desvinculación a tu administrador.`
          };
        } else {
          await client
            .from('sportstats_users')
            .update({
              last_active_at: nowMs,
              bound_device_name: friendlyDevName
            })
            .eq('id', data.id);
        }

        const daysRemaining = data.expires_at ? Math.max(0, Math.ceil((data.expires_at - nowMs) / (24 * 60 * 60 * 1000))) : null;

        const resolvedUser: AppUser = {
          id: data.id,
          username: data.username,
          displayName: data.display_name || undefined,
          role: data.role || 'client',
          status: data.status || 'active',
          planType: data.plan_type || '30D',
          planLabel: data.plan_label || 'Pase Activo',
          createdAt: Number(data.created_at || nowMs),
          expiresAt: data.expires_at ? Number(data.expires_at) : null,
          boundDeviceId: data.bound_device_id,
          boundDeviceName: data.bound_device_name,
          boundDeviceUpdatedAt: data.bound_device_updated_at,
          lastActiveAt: nowMs,
          whatsappNumber: data.whatsapp_number,
          notes: data.notes,
          daysRemaining,
          isExpired: data.expires_at ? data.expires_at < nowMs : false
        };

        return {
          success: true,
          message: 'Autenticación exitosa',
          user: resolvedUser
        };
      }
    } catch (err) {
      console.error('[Supabase User Login Excepción]:', err);
    }
  }

  // Fallback en base de datos local del servidor
  const localUsers = getLocalUsersDb();
  await migrateLegacyLocalPins(localUsers);
  const localUser = localUsers.find((u) => u.username === username);
  if (localUser) {
    const pinCheck = await verifyPin(pin, localUser.pinHash);
    if (!pinCheck.valid) {
      return {
        success: false,
        code: 'INVALID_PIN',
        message: 'El PIN ingresado no es correcto para este usuario.'
      };
    }
    if (pinCheck.upgradedHash) {
      localUser.pinHash = pinCheck.upgradedHash;
      if (!saveLocalUsersDb(localUsers)) {
        return {
          success: false,
          code: 'SERVER_ERROR',
          message: 'No se pudo proteger el PIN de esta cuenta. Intenta de nuevo más tarde.'
        };
      }
    }

    if (localUser.role === 'admin') {
      return {
        success: false,
        code: 'INVALID_PIN',
        message: 'El administrador debe ingresar desde el panel administrativo.'
      };
    }

    if (localUser.status === 'pending') {
      return {
        success: false,
        code: 'PENDING_APPROVAL',
        message: 'Tu cuenta está pendiente de activación por el administrador.'
      };
    }
    if (localUser.status === 'suspended') {
      return {
        success: false,
        code: 'SUSPENDED',
        message: 'Tu cuenta ha sido suspendida. Contacta al administrador.'
      };
    }
    if (localUser.expiresAt && localUser.expiresAt < nowMs) {
      return {
        success: false,
        code: 'EXPIRED',
        message: 'Tu plan de acceso ha vencido. Contacta al administrador para renovar.'
      };
    }

    if (!localUser.boundDeviceId) {
      localUser.boundDeviceId = cleanDevice;
      localUser.boundDeviceName = friendlyDevName;
      localUser.boundDeviceUpdatedAt = new Date().toISOString();
      localUser.lastActiveAt = nowMs;
      saveLocalUsersDb(localUsers);
    } else if (localUser.boundDeviceId !== cleanDevice) {
      return {
        success: false,
        code: 'DEVICE_LOCKED',
        boundDeviceName: localUser.boundDeviceName || 'Dispositivo Principal',
        message: `Esta cuenta ya está vinculada a otro dispositivo (${localUser.boundDeviceName || 'dispositivo principal'}). Para cambiar de equipo solicita la desvinculación a tu administrador.`
      };
    } else {
      localUser.lastActiveAt = nowMs;
      localUser.boundDeviceName = friendlyDevName;
      saveLocalUsersDb(localUsers);
    }

    const daysRemaining = localUser.expiresAt
      ? Math.max(0, Math.ceil((localUser.expiresAt - nowMs) / (24 * 60 * 60 * 1000)))
      : null;

    return {
      success: true,
      message: 'Autenticación exitosa',
      user: {
        id: localUser.id,
        username: localUser.username,
        displayName: localUser.displayName,
        role: localUser.role,
        status: localUser.status,
        planType: localUser.planType,
        planLabel: localUser.planLabel,
        createdAt: localUser.createdAt,
        expiresAt: localUser.expiresAt,
        boundDeviceId: localUser.boundDeviceId,
        boundDeviceName: localUser.boundDeviceName,
        boundDeviceUpdatedAt: localUser.boundDeviceUpdatedAt,
        lastActiveAt: localUser.lastActiveAt,
        whatsappNumber: localUser.whatsappNumber,
        notes: localUser.notes,
        daysRemaining,
        isExpired: localUser.expiresAt ? localUser.expiresAt < nowMs : false
      }
    };
  }

  return {
    success: false,
    code: 'USER_NOT_FOUND',
    message: 'El usuario no existe o las credenciales no son válidas.'
  };
}

export async function registerAppUserRequest(
  rawUsername: string,
  rawPin: string,
  displayName?: string,
  whatsapp?: string
): Promise<{ success: boolean; code?: string; message: string; username?: string }> {
  const username = normalizeUsername(rawUsername);
  const pin = String(rawPin || '').trim();

  if (!username || username.length < 3) {
    return {
      success: false,
      code: 'INVALID_USERNAME',
      message: 'El nombre de usuario debe tener entre 3 y 20 caracteres (solo letras de a-z y números).'
    };
  }

  if (!pin || pin.length < 4) {
    return {
      success: false,
      code: 'INVALID_PIN',
      message: 'El PIN debe tener al menos 4 dígitos.'
    };
  }

  const client = getSupabaseClient();
  const nowMs = Date.now();
  const cleanDisplayName = displayName ? displayName.trim() : undefined;
  const cleanWhatsapp = whatsapp ? whatsapp.replace(/[^0-9]/g, '') : undefined;
  const pinHash = await hashPin(pin);

  // 1. Guardar siempre en el respaldo local del servidor para garantizar 0 fallos de conexión
  const localUsers = getLocalUsersDb();
  await migrateLegacyLocalPins(localUsers);
  const existingLocal = localUsers.find((u) => u.username === username);
  if (existingLocal && existingLocal.status === 'active') {
    return {
      success: false,
      code: 'USER_EXISTS',
      message: 'Este nombre de usuario ya está activo y registrado. Elige otro o inicia sesión.'
    };
  }

  const newRecord: StoredAppUser = existingLocal || {
    id: crypto.randomUUID ? crypto.randomUUID() : `USR-${Date.now().toString(36).toUpperCase()}`,
    username,
    displayName: cleanDisplayName,
    pinHash,
    role: 'client',
    status: 'pending',
    planType: '30D',
    planLabel: 'Pase 30 Días',
    createdAt: nowMs,
    expiresAt: nowMs + 30 * 24 * 60 * 60 * 1000,
    boundDeviceId: null,
    boundDeviceName: null,
    whatsappNumber: cleanWhatsapp || null,
    daysRemaining: 30,
    isExpired: false
  };

  if (existingLocal) {
    existingLocal.pinHash = pinHash;
    if (cleanDisplayName) existingLocal.displayName = cleanDisplayName;
    if (cleanWhatsapp) existingLocal.whatsappNumber = cleanWhatsapp;
  } else {
    localUsers.unshift(newRecord);
  }
  if (!saveLocalUsersDb(localUsers)) {
    return {
      success: false,
      code: 'SERVER_ERROR',
      message: 'No se pudo guardar la solicitud. Intenta de nuevo más tarde.'
    };
  }

  // 2. Sincronizar con Supabase si está configurado
  if (client) {
    try {
      const { data: existing, error: lookupError } = await client
        .from('sportstats_users')
        .select('id, username, status')
        .eq('username', username)
        .maybeSingle();
      if (lookupError) {
        console.error('[Supabase Register Lookup Error]:', lookupError.message);
        return {
          success: false,
          code: 'SERVER_ERROR',
          message: 'No se pudo guardar la solicitud en la base de datos. Intenta de nuevo.'
        };
      }

      if (existing) {
        if (existing.status === 'active') {
          return {
            success: false,
            code: 'USER_EXISTS',
            message: 'Este nombre de usuario ya está registrado. Elige otro o inicia sesión.'
          };
        }
        // Si estaba en pending, actualizar sus datos de solicitud
        const { error: updateError } = await client
          .from('sportstats_users')
          .update({
            pin_hash: pinHash,
            display_name: cleanDisplayName || null,
            whatsapp_number: cleanWhatsapp || null
          })
          .eq('id', existing.id);
        if (updateError) {
          console.error('[Supabase Register Update Error]:', updateError.message);
          return {
            success: false,
            code: 'SERVER_ERROR',
            message: 'No se pudo actualizar la solicitud en la base de datos. Intenta de nuevo.'
          };
        }

        return {
          success: true,
          message: 'Solicitud actualizada con éxito. Contacta al administrador para activar tu acceso.',
          username
        };
      }

      const { error } = await client.from('sportstats_users').insert({
        username,
        display_name: cleanDisplayName || null,
        pin_hash: pinHash,
        role: 'client',
        status: 'pending',
        plan_type: '30D',
        plan_label: 'Pase 30 Días',
        created_at: nowMs,
        expires_at: nowMs + 30 * 24 * 60 * 60 * 1000,
        bound_device_id: null,
        whatsapp_number: cleanWhatsapp || null
      });

      if (error) {
        console.warn('[Supabase Register Fallback Local]:', error.message);
        return {
          success: false,
          code: 'SERVER_ERROR',
          message: 'No se pudo guardar la solicitud en la base de datos. Intenta de nuevo.'
        };
      }
    } catch (err) {
      console.warn('[Supabase Register Excepción Fallback Local]:', err);
      return {
        success: false,
        code: 'SERVER_ERROR',
        message: 'No se pudo guardar la solicitud en la base de datos. Intenta de nuevo.'
      };
    }
  }

  return {
    success: true,
    message: 'Solicitud creada con éxito. Contacta al administrador para activar tu acceso.',
    username
  };
}

export async function adminListAppUsers(): Promise<AppUser[]> {
  const client = getSupabaseClient();
  const nowMs = Date.now();
  const localUsers = getLocalUsersDb();
  await migrateLegacyLocalPins(localUsers);
  const mergedMap = new Map<string, AppUser>();

  // Primero poblar desde base local
  for (const u of localUsers) {
    const daysRemaining = u.expiresAt ? Math.max(0, Math.ceil((u.expiresAt - nowMs) / (24 * 60 * 60 * 1000))) : null;
    const isExpired = u.expiresAt ? u.expiresAt < nowMs : false;
    mergedMap.set(u.username, toPublicAppUser(u, daysRemaining, isExpired));
  }

  if (client) {
    try {
      const { data, error } = await client
        .from('sportstats_users')
        .select('id, username, display_name, role, status, plan_type, plan_label, created_at, expires_at, bound_device_id, bound_device_name, bound_device_updated_at, last_active_at, whatsapp_number, notes')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const daysRemaining = row.expires_at ? Math.max(0, Math.ceil((row.expires_at - nowMs) / (24 * 60 * 60 * 1000))) : null;
          const isExpired = row.expires_at ? row.expires_at < nowMs : false;

          const item: AppUser = {
            id: row.id,
            username: row.username,
            displayName: row.display_name || undefined,
            role: row.role || 'client',
            status: row.status || 'active',
            planType: row.plan_type || '30D',
            planLabel: row.plan_label || 'Pase Mensual',
            createdAt: Number(row.created_at || nowMs),
            expiresAt: row.expires_at ? Number(row.expires_at) : null,
            boundDeviceId: row.bound_device_id,
            boundDeviceName: row.bound_device_name,
            boundDeviceUpdatedAt: row.bound_device_updated_at,
            lastActiveAt: row.last_active_at ? Number(row.last_active_at) : null,
            whatsappNumber: row.whatsapp_number,
            notes: row.notes,
            daysRemaining,
            isExpired
          };
          mergedMap.set(item.username, item);
        }
      }
    } catch (err) {
      console.error('[adminListAppUsers Error]:', err);
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function toPublicAppUser(user: StoredAppUser, daysRemaining?: number | null, isExpired?: boolean): AppUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    planType: user.planType,
    planLabel: user.planLabel,
    createdAt: user.createdAt,
    expiresAt: user.expiresAt,
    boundDeviceId: user.boundDeviceId,
    boundDeviceName: user.boundDeviceName,
    boundDeviceUpdatedAt: user.boundDeviceUpdatedAt,
    lastActiveAt: user.lastActiveAt,
    whatsappNumber: user.whatsappNumber,
    notes: user.notes,
    daysRemaining,
    isExpired
  };
}

// Resetea el dispositivo vinculado para que el cliente pueda registrar un nuevo teléfono
export async function adminResetAppUserDevice(userId: string): Promise<boolean> {
  let updatedLocal = false;
  const localUsers = getLocalUsersDb();
  await migrateLegacyLocalPins(localUsers);
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId) {
      u.boundDeviceId = null;
      u.boundDeviceName = null;
      u.boundDeviceUpdatedAt = null;
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client
        .from('sportstats_users')
        .update({
          bound_device_id: null,
          bound_device_name: null,
          bound_device_updated_at: null
        })
        .eq('id', userId);

      if (!error) return true;
    } catch {
      // ignore
    }
  }

  return updatedLocal;
}

// Renueva la suscripción sumando días (+15, +30, etc.)
export async function adminRenewAppUser(userId: string, addDays: number): Promise<boolean> {
  const nowMs = Date.now();
  const daysMs = Number(addDays) * 24 * 60 * 60 * 1000;
  let updatedLocal = false;

  const localUsers = getLocalUsersDb();
  await migrateLegacyLocalPins(localUsers);
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId) {
      if (u.expiresAt && u.expiresAt > nowMs) {
        u.expiresAt = u.expiresAt + daysMs;
      } else {
        u.expiresAt = nowMs + daysMs;
      }
      u.status = 'active';
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: user } = await client
        .from('sportstats_users')
        .select('expires_at')
        .eq('id', userId)
        .single();

      let newExpiry = nowMs + daysMs;
      if (user && user.expires_at && user.expires_at > nowMs) {
        newExpiry = user.expires_at + daysMs;
      }

      const { error } = await client
        .from('sportstats_users')
        .update({
          expires_at: newExpiry,
          status: 'active'
        })
        .eq('id', userId);

      if (!error) return true;
    } catch {
      // ignore
    }
  }

  return updatedLocal;
}

// Activa o suspende un usuario
export async function adminToggleAppUserStatus(userId: string, newStatus: 'active' | 'suspended'): Promise<boolean> {
  let updatedLocal = false;
  const localUsers = getLocalUsersDb();
  await migrateLegacyLocalPins(localUsers);
  for (const u of localUsers) {
    if (u.id === userId || u.username === userId) {
      u.status = newStatus;
      updatedLocal = true;
    }
  }
  if (updatedLocal) saveLocalUsersDb(localUsers);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client
        .from('sportstats_users')
        .update({ status: newStatus })
        .eq('id', userId);

      if (!error) return true;
    } catch {
      // ignore
    }
  }

  return updatedLocal;
}

// Crear o actualizar usuario manualmente por el admin
export async function adminUpsertAppUser(user: Partial<AppUser> & { pin?: string }): Promise<boolean> {
  if (!user.username) return false;
  const cleanUser = normalizeUsername(user.username);
  if (!cleanUser) return false;
  const pin = String(user.pin || '').trim();
  if (pin.length < 4) return false;

  const nowMs = Date.now();
  const defaultExpiry = nowMs + 30 * 24 * 60 * 60 * 1000;
  const pinHash = await hashPin(pin);

  const localUsers = getLocalUsersDb();
  await migrateLegacyLocalPins(localUsers);
  const existingIdx = localUsers.findIndex((u) => u.username === cleanUser);
  const localRecord: StoredAppUser = {
    id: existingIdx >= 0 ? localUsers[existingIdx].id : (crypto.randomUUID ? crypto.randomUUID() : `USR-${Date.now().toString(36).toUpperCase()}`),
    username: cleanUser,
    displayName: user.displayName || (existingIdx >= 0 ? localUsers[existingIdx].displayName : undefined),
    pinHash,
    role: user.role || 'client',
    status: user.status || 'active',
    planType: user.planType || '30D',
    planLabel: user.planLabel || 'Pase Mensual (30 Días)',
    createdAt: user.createdAt || (existingIdx >= 0 ? localUsers[existingIdx].createdAt : nowMs),
    expiresAt: user.expiresAt !== undefined ? user.expiresAt : defaultExpiry,
    boundDeviceId: user.boundDeviceId !== undefined ? user.boundDeviceId : (existingIdx >= 0 ? localUsers[existingIdx].boundDeviceId : null),
    boundDeviceName: user.boundDeviceName !== undefined ? user.boundDeviceName : (existingIdx >= 0 ? localUsers[existingIdx].boundDeviceName : null),
    whatsappNumber: user.whatsappNumber || (existingIdx >= 0 ? localUsers[existingIdx].whatsappNumber : null),
    notes: user.notes || (existingIdx >= 0 ? localUsers[existingIdx].notes : null)
  };

  if (existingIdx >= 0) {
    localUsers[existingIdx] = localRecord;
  } else {
    localUsers.unshift(localRecord);
  }
  if (!saveLocalUsersDb(localUsers)) return false;

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('sportstats_users').upsert(
        {
          username: cleanUser,
          display_name: localRecord.displayName || null,
          pin_hash: localRecord.pinHash,
          role: localRecord.role,
          status: localRecord.status,
          plan_type: localRecord.planType,
          plan_label: localRecord.planLabel,
          created_at: localRecord.createdAt,
          expires_at: localRecord.expiresAt,
          bound_device_id: localRecord.boundDeviceId || null,
          bound_device_name: localRecord.boundDeviceName || null,
          whatsapp_number: localRecord.whatsappNumber || null,
          notes: localRecord.notes || null
        },
        { onConflict: 'username' }
      );
      if (error) {
        console.error('[Supabase Admin User Upsert Error]:', error.message);
        return false;
      }
    } catch (error) {
      console.error('[Supabase Admin User Upsert Exception]:', error);
      return false;
    }
  }

  return true;
}

// SQL Script para crear las tablas en Supabase con un solo clic en el SQL Editor de Supabase
export const SUPABASE_SQL_SCHEMA = `
-- =========================================================================
-- TABLAS OFICIALES PARA SPORTSTATS PRO EN SUPABASE (PostgreSQL)
-- =========================================================================

CREATE TABLE IF NOT EXISTS sportstats_licenses (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  client_note TEXT,
  client_name TEXT,
  plan_type TEXT NOT NULL,
  plan_label TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT,
  last_active_timestamp BIGINT,
  device_info TEXT,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sportstats_licenses_key
  ON sportstats_licenses(key);
CREATE INDEX IF NOT EXISTS idx_sportstats_licenses_device
  ON sportstats_licenses(device_id);
ALTER TABLE sportstats_licenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sportstats_licenses FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE sportstats_licenses TO service_role;

CREATE TABLE IF NOT EXISTS sportstats_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL CONSTRAINT chk_valid_username CHECK (username ~ '^[a-z0-9]{3,20}$'),
  display_name TEXT,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  status TEXT NOT NULL DEFAULT 'pending',
  plan_type TEXT NOT NULL DEFAULT '30D',
  plan_label TEXT NOT NULL DEFAULT 'Pase Mensual',
  created_at BIGINT NOT NULL,
  expires_at BIGINT,
  bound_device_id TEXT,
  bound_device_name TEXT,
  bound_device_updated_at TIMESTAMPTZ,
  last_active_at BIGINT,
  whatsapp_number TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username ON sportstats_users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON sportstats_users(status);
CREATE INDEX IF NOT EXISTS idx_users_device ON sportstats_users(bound_device_id);

CREATE TABLE IF NOT EXISTS sportstats_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  admin_whatsapp TEXT NOT NULL DEFAULT '573213902708',
  support_name TEXT DEFAULT 'SportStats Pro VIP',
  custom_logo_url TEXT,
  color_theme TEXT DEFAULT 'cyan-emerald',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sportstats_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sportstats_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE sportstats_config DROP COLUMN IF EXISTS admin_pin;
DROP POLICY IF EXISTS "Allow server full access users" ON sportstats_users;
DROP POLICY IF EXISTS "Allow server full access config" ON sportstats_config;
REVOKE ALL ON TABLE sportstats_users, sportstats_config FROM anon, authenticated;
GRANT ALL ON TABLE sportstats_users, sportstats_config TO service_role;

CREATE TABLE IF NOT EXISTS sportstats_admin_login_attempts (
  ip_hash TEXT PRIMARY KEY CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  attempt_count INTEGER NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_window
  ON sportstats_admin_login_attempts(window_started_at);

ALTER TABLE sportstats_admin_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sportstats_admin_login_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE sportstats_admin_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.sportstats_consume_admin_login_attempt(
  p_ip_hash TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER,
  p_reset BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(blocked BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_attempt_count INTEGER;
  v_window_started_at TIMESTAMPTZ;
BEGIN
  IF p_ip_hash IS NULL
    OR p_ip_hash !~ '^[0-9a-f]{64}$'
    OR p_max_attempts IS NULL
    OR p_max_attempts < 1
    OR p_window_seconds IS NULL
    OR p_window_seconds < 1
  THEN
    RAISE EXCEPTION 'Invalid administrator login throttle parameters';
  END IF;

  IF p_reset THEN
    DELETE FROM public.sportstats_admin_login_attempts AS attempts
    WHERE attempts.ip_hash = p_ip_hash;
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  DELETE FROM public.sportstats_admin_login_attempts AS attempts
  WHERE attempts.window_started_at < v_now - INTERVAL '24 hours';

  INSERT INTO public.sportstats_admin_login_attempts AS attempts (
    ip_hash,
    attempt_count,
    window_started_at,
    updated_at
  )
  VALUES (p_ip_hash, 1, v_now, v_now)
  ON CONFLICT (ip_hash) DO UPDATE
  SET attempt_count = CASE
        WHEN attempts.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN 1
        ELSE LEAST(attempts.attempt_count + 1, p_max_attempts + 1)
      END,
      window_started_at = CASE
        WHEN attempts.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN v_now
        ELSE attempts.window_started_at
      END,
      updated_at = v_now
  RETURNING attempts.attempt_count, attempts.window_started_at
  INTO v_attempt_count, v_window_started_at;

  RETURN QUERY
  SELECT
    v_attempt_count > p_max_attempts,
    CASE
      WHEN v_attempt_count > p_max_attempts THEN
        GREATEST(
          1,
          CEIL(EXTRACT(EPOCH FROM v_window_started_at + make_interval(secs => p_window_seconds) - v_now))::INTEGER
        )
      ELSE 0
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.sportstats_consume_admin_login_attempt(TEXT, INTEGER, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sportstats_consume_admin_login_attempt(TEXT, INTEGER, INTEGER, BOOLEAN)
  TO service_role;

CREATE TABLE IF NOT EXISTS sportstats_client_login_attempts (
  login_key_hash TEXT PRIMARY KEY CHECK (login_key_hash ~ '^[0-9a-f]{64}$'),
  attempt_count INTEGER NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_login_attempts_window
  ON sportstats_client_login_attempts(window_started_at);

ALTER TABLE sportstats_client_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sportstats_client_login_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE sportstats_client_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.sportstats_consume_client_login_attempt(
  p_login_key_hash TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER,
  p_reset BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(blocked BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_attempt_count INTEGER;
  v_window_started_at TIMESTAMPTZ;
BEGIN
  IF p_login_key_hash IS NULL
    OR p_login_key_hash !~ '^[0-9a-f]{64}$'
    OR p_max_attempts IS NULL
    OR p_max_attempts < 1
    OR p_window_seconds IS NULL
    OR p_window_seconds < 1
  THEN
    RAISE EXCEPTION 'Invalid client login throttle parameters';
  END IF;

  IF p_reset THEN
    DELETE FROM public.sportstats_client_login_attempts AS attempts
    WHERE attempts.login_key_hash = p_login_key_hash;
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  DELETE FROM public.sportstats_client_login_attempts AS attempts
  WHERE attempts.window_started_at < v_now - INTERVAL '24 hours';

  INSERT INTO public.sportstats_client_login_attempts AS attempts (
    login_key_hash,
    attempt_count,
    window_started_at,
    updated_at
  )
  VALUES (p_login_key_hash, 1, v_now, v_now)
  ON CONFLICT (login_key_hash) DO UPDATE
  SET attempt_count = CASE
        WHEN attempts.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN 1
        ELSE LEAST(attempts.attempt_count + 1, p_max_attempts + 1)
      END,
      window_started_at = CASE
        WHEN attempts.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN v_now
        ELSE attempts.window_started_at
      END,
      updated_at = v_now
  RETURNING attempts.attempt_count, attempts.window_started_at
  INTO v_attempt_count, v_window_started_at;

  RETURN QUERY
  SELECT
    v_attempt_count > p_max_attempts,
    CASE
      WHEN v_attempt_count > p_max_attempts THEN
        GREATEST(
          1,
          CEIL(EXTRACT(EPOCH FROM v_window_started_at + make_interval(secs => p_window_seconds) - v_now))::INTEGER
        )
      ELSE 0
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.sportstats_consume_client_login_attempt(TEXT, INTEGER, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sportstats_consume_client_login_attempt(TEXT, INTEGER, INTEGER, BOOLEAN)
  TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sportstats_users' AND policyname = 'Server role users access') THEN
    CREATE POLICY "Server role users access" ON sportstats_users FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sportstats_config' AND policyname = 'Server role config access') THEN
    CREATE POLICY "Server role config access" ON sportstats_config FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
`;
