export interface LicenseValidationResult {
  isValid: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'INVALID_DEVICE' | 'INVALID_SIGNATURE' | 'MALFORMED' | 'REVOKED';
  message: string;
  isPermanent: boolean;
  isExpired: boolean;
  expiryTimestamp: number | null;
  expiryDateFormatted: string;
  daysRemaining: number | null;
  targetDeviceId: string;
  planLabel: string;
  clientName?: string;
}

export interface StoredLicense {
  key: string;
  activatedAt: number;
  cachedResult: LicenseValidationResult;
  offlineGrant?: string;
  licensePublicKey?: string;
}

export function toLicenseValidationResult(
  data: Record<string, unknown>,
  currentDeviceId: string
): LicenseValidationResult | null {
  if (data.isValid !== true) return null;
  const rawExpiry = data.expiryTimestamp;
  const expiryTimestamp = rawExpiry === null || rawExpiry === undefined
    ? null
    : Number(rawExpiry);
  if (expiryTimestamp !== null && !Number.isFinite(expiryTimestamp)) return null;

  const isPermanent = data.isPermanent === true || expiryTimestamp === null;
  return {
    isValid: true,
    status: 'ACTIVE',
    message: typeof data.message === 'string' ? data.message : 'Licencia activa',
    isPermanent,
    isExpired: false,
    expiryTimestamp,
    expiryDateFormatted: isPermanent
      ? 'Permanente (Sin vencimiento)'
      : new Date(expiryTimestamp as number).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
    daysRemaining: data.daysRemaining === null || data.daysRemaining === undefined
      ? null
      : Number(data.daysRemaining),
    targetDeviceId: currentDeviceId,
    planLabel: typeof data.planLabel === 'string' ? data.planLabel : 'Pase activo',
    clientName: typeof data.clientName === 'string' ? data.clientName : undefined
  };
}

interface OfflineGrantClaims {
  type: 'offline';
  userId?: string;
  licenseKey?: string;
  deviceId: string;
  issuedAt: number;
  expiresAt: number | null;
  offlineExpiresAt: number;
  planType: string;
  planLabel: string;
  clientName?: string;
}

const STORAGE_KEY_DEVICE_ID = 'futbolstats_device_id';
const STORAGE_KEY_ACTIVE_LICENSE = 'futbolstats_active_license';

export function sanitizeDeviceId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().replace(/^DEV/, '');
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (existing && /^DEV-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(existing)) {
      return existing.toUpperCase();
    }
  } catch {
    // Browser storage may be unavailable in private contexts.
  }

  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  const generated = `DEV-${value.slice(0, 4)}-${value.slice(4, 8)}`;

  try {
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, generated);
  } catch {
    // The current session can still use the generated identifier.
  }

  return generated;
}

function decodeBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function decodeClaims(payload: string): OfflineGrantClaims | null {
  try {
    const bytes = decodeBase64Url(payload);
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as OfflineGrantClaims;
    if (
      claims.type !== 'offline' ||
      typeof claims.deviceId !== 'string' ||
      !Number.isFinite(claims.issuedAt) ||
      !Number.isFinite(claims.offlineExpiresAt) ||
      (claims.expiresAt !== null && !Number.isFinite(claims.expiresAt)) ||
      typeof claims.planType !== 'string' ||
      typeof claims.planLabel !== 'string' ||
      (!claims.userId && !claims.licenseKey)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export async function verifyOfflineLicenseGrant(
  grant: string,
  publicKey: string,
  currentDeviceId: string
): Promise<LicenseValidationResult | null> {
  const [prefix, payload, signature, extra] = grant.split('.');
  if (prefix !== 'OF1' || !payload || !signature || extra) return null;

  try {
    const importedKey = await globalThis.crypto.subtle.importKey(
      'spki',
      decodeBase64Url(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    const validSignature = await globalThis.crypto.subtle.verify(
      { name: 'Ed25519' },
      importedKey,
      decodeBase64Url(signature),
      new TextEncoder().encode(`${prefix}.${payload}`)
    );
    if (!validSignature) return null;

    const claims = decodeClaims(payload);
    const now = Date.now();
    if (
      !claims ||
      sanitizeDeviceId(claims.deviceId) !== sanitizeDeviceId(currentDeviceId) ||
      claims.issuedAt > now + 5 * 60 * 1000 ||
      claims.offlineExpiresAt <= now ||
      (claims.expiresAt !== null && claims.expiresAt <= now)
    ) {
      return null;
    }

    const expiryDateFormatted = claims.expiresAt === null
      ? 'Permanente (Sin vencimiento)'
      : new Date(claims.expiresAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

    return {
      isValid: true,
      status: 'ACTIVE',
      message: 'Acceso offline temporal activo',
      isPermanent: claims.expiresAt === null,
      isExpired: false,
      expiryTimestamp: claims.expiresAt,
      expiryDateFormatted,
      daysRemaining: claims.expiresAt === null
        ? null
        : Math.max(0, Math.ceil((claims.expiresAt - now) / 86400000)),
      targetDeviceId: claims.deviceId,
      planLabel: claims.planLabel,
      clientName: claims.clientName
    };
  } catch {
    return null;
  }
}

export function saveActiveLicense(
  key: string,
  result: LicenseValidationResult,
  offlineGrant?: string,
  licensePublicKey?: string
): void {
  try {
    const payload: StoredLicense = {
      key,
      activatedAt: Date.now(),
      cachedResult: result,
      offlineGrant,
      licensePublicKey
    };
    localStorage.setItem(STORAGE_KEY_ACTIVE_LICENSE, JSON.stringify(payload));
  } catch {
    // The caller still keeps the validated session in memory.
  }
}

export function getActiveStoredLicense(): StoredLicense | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_LICENSE);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredLicense;
    if (!stored || typeof stored.key !== 'string' || !stored.cachedResult) return null;
    return stored;
  } catch {
    return null;
  }
}

export function clearActiveLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_LICENSE);
  } catch {
    // Browser storage may be unavailable.
  }
}
