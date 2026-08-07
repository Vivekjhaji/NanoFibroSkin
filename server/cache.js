export function createCache(ttlMs) {
  const store = new Map();

  function isExpired(entry) {
    return Date.now() - entry.timestamp > ttlMs;
  }

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry || isExpired(entry)) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      store.set(key, { value, timestamp: Date.now() });
    },
    has(key) {
      const entry = store.get(key);
      if (!entry || isExpired(entry)) {
        store.delete(key);
        return false;
      }
      return true;
    },
  };
}
