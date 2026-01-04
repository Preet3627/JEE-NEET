export async function safeFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, { ...options });
    if (!res.ok) {
      console.warn(`safeFetch: network error ${res.status} ${url}`);
      return null;
    }
    return res;
  } catch (err) {
    // Avoid noisy repeated logs for same URL
    console.warn(`safeFetch: failed to fetch ${url}:`, err);
    return null;
  }
}