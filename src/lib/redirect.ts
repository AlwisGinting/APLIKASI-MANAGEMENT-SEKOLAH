/** Only local paths; reject URL parser normalization and encoded separators. */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f\u007f]|%/u.test(value)) return fallback;
  const base = "https://internal.invalid";
  try {
    const url = new URL(value, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
