export const isSafeImageSource = (source) => {
  if (typeof source !== 'string' || source.length > 4_000_000) return false;
  return /^https:\/\/[^\s"']+$/i.test(source) || /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(source);
};

export const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 8_000_000) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writeJson = (key, value) => {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 8_000_000) return false;
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
};
