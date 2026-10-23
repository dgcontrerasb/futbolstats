import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from '../src/services/supabaseServer.ts';

dotenv.config();

const PIN_HASH_PATTERN = /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/;
const PIN_SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PAGE_SIZE = 100;

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(pin, salt, 64, PIN_SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function migrateLegacyClientPins(): Promise<void> {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this migration.');
  }

  const client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  let cursor: string | null = null;
  let migrated = 0;
  let alreadyHashed = 0;

  while (true) {
    let query = client
      .from('sportstats_users')
      .select('id, pin_hash')
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);

    if (cursor) query = query.gt('id', cursor);

    const { data, error } = await query;
    if (error) {
      throw new Error(`Could not read client PIN records from Supabase: ${error.message}`);
    }

    if (!data?.length) break;

    for (const row of data) {
      if (typeof row.id !== 'string' || typeof row.pin_hash !== 'string') {
        throw new Error('Supabase returned an invalid client PIN record.');
      }

      if (PIN_HASH_PATTERN.test(row.pin_hash)) {
        alreadyHashed += 1;
        continue;
      }

      const pinHash = await hashPin(row.pin_hash);
      const { data: updated, error: updateError } = await client
        .from('sportstats_users')
        .update({ pin_hash: pinHash })
        .eq('id', row.id)
        .eq('pin_hash', row.pin_hash)
        .select('id');

      if (updateError) {
        throw new Error(`Could not update a client PIN record: ${updateError.message}`);
      }

      if (updated?.length === 1) {
        migrated += 1;
        continue;
      }

      const { data: current, error: lookupError } = await client
        .from('sportstats_users')
        .select('pin_hash')
        .eq('id', row.id)
        .maybeSingle();

      if (lookupError) {
        throw new Error(`Could not verify a concurrently updated client PIN record: ${lookupError.message}`);
      }

      if (!current || (typeof current.pin_hash === 'string' && PIN_HASH_PATTERN.test(current.pin_hash))) {
        alreadyHashed += 1;
        continue;
      }

      throw new Error('A client PIN record changed during migration. Rerun the migration to continue safely.');
    }

    cursor = data[data.length - 1].id;
  }

  console.log(`Client PIN migration complete. Hashed ${migrated} legacy PINs; ${alreadyHashed} records were already hashed or updated concurrently.`);
}

migrateLegacyClientPins().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown migration error.';
  console.error(`Client PIN migration failed: ${message}`);
  process.exitCode = 1;
});
