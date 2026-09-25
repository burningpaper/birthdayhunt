import { HuntSchema, ProgressSchema, type Hunt, type Progress } from "../schema";

/**
 * Stored data is re-validated on the way out. A record that no longer matches
 * the schema is logged loudly and treated as missing, rather than crashing a
 * child's scan with a half-shaped object.
 */
export function parseHunt(raw: unknown, key: string): Hunt | null {
  if (raw == null) return null;
  const result = HuntSchema.safeParse(raw);
  if (!result.success) {
    console.error(`[store] ${key} failed validation`, result.error.issues);
    return null;
  }
  return result.data;
}

export function parseProgress(raw: unknown, key: string): Progress | null {
  if (raw == null) return null;
  const result = ProgressSchema.safeParse(raw);
  if (!result.success) {
    console.error(`[store] ${key} failed validation`, result.error.issues);
    return null;
  }
  return result.data;
}
