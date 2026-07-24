/**
 * Firestore rejects `undefined` field values.
 * Strip them (and optionally replace cleared fields with FieldValue.delete()).
 */
export function stripUndefined<T extends Record<string, unknown>>(
  data: T
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
