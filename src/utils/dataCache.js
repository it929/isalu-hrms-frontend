const cache = new Map();

export const getCache = (key) => cache.get(key);
export const setCache = (key, data) => cache.set(key, data);
export const hasCache = (key) => cache.has(key);
export const clearCache = (key) => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};
