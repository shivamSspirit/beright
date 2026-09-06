import { createHash } from 'node:crypto';

type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

function normalizeCanonicalValue(value: unknown, path: string): CanonicalJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item, index) => normalizeCanonicalValue(item, `${path}[${index}]`));
  if (typeof value === 'object') {
    const output: { [key: string]: CanonicalJson } = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) throw new TypeError(`Undefined value at ${path}.${key}`);
      output[key] = normalizeCanonicalValue(child, `${path}.${key}`);
    }
    return output;
  }
  throw new TypeError(`Unsupported canonical JSON value at ${path}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeCanonicalValue(value, '$'));
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashCanonicalJson(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
