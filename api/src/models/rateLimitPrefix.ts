/** Stable Redis prefix segment: category + key-kind + window/limit. */
export function rateLimitStorePrefix(
  namespace: string,
  keyKind: string,
  windowMs: number | undefined,
  limit: number | string | undefined
): string {
  return `${namespace}:${keyKind}:${windowMs}-${limit}`;
}
