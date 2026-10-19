export function chatTimeoutMs(config) {
  const value = config?.chatTimeoutMs;
  if (value === undefined) return 90000;
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
    throw new Error("Invalid embed chatTimeoutMs configuration");
  }
  return value;
}
