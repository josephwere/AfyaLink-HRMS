export async function apiFetch(path, opts = {}) {
  const base = import.meta.env.VITE_API_URL || '';

  const defaults = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const merged = { ...defaults, ...opts };

  if (
    merged.body &&
    typeof merged.body === 'object' &&
    !(merged.body instanceof FormData)
  ) {
    merged.body = JSON.stringify(merged.body);
  }

  let r = await fetch(base + path, merged);

  if (r.status === 401) {
    const rt = await fetch(base + '/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (rt.ok) {
      r = await fetch(base + path, merged);
    }
  }

  return r;
}
