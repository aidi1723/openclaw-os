export function getJsonFromStorage<T>(
  key: string,
  fallback: T,
  storage?: Storage,
): T {
  if (!storage && typeof window === "undefined") return fallback;
  try {
    const resolvedStorage = storage ?? window.localStorage;
    const raw = resolvedStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJsonToStorage<T>(
  key: string,
  value: T,
  storage?: Storage,
) {
  if (!storage && typeof window === "undefined") return;
  const resolvedStorage = storage ?? window.localStorage;
  resolvedStorage.setItem(key, JSON.stringify(value));
}
