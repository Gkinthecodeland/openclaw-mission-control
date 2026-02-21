/**
 * Redact a sensitive value, showing only the last 4 characters.
 */
export function redactValue(value: string | null | undefined): string {
  if (!value || value.length < 8) return "••••••••";
  return "••••" + value.slice(-4);
}

/**
 * Check if a key name looks like a credential/secret.
 */
export function isCredentialKey(key: string): boolean {
  const patterns = /(_KEY|_TOKEN|_SECRET|_PASSWORD|API_KEY|AUTH|CREDENTIAL|PRIVATE)/i;
  return patterns.test(key);
}

/**
 * Deep-redact an object, masking values for keys that look like credentials.
 */
export function deepRedact<T>(obj: T): T {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(deepRedact) as T;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === "string" && isCredentialKey(key)) {
      result[key] = redactValue(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = deepRedact(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
