/** Bound backend waits and prevent private responses entering the fetch cache. */
export const supabaseFetch: typeof fetch = async (input, init) => {
  const timeout = AbortSignal.timeout(12_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    const response = await fetch(input, { ...init, cache: "no-store", signal });
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (response.ok && url.pathname === "/auth/v1/token") {
      // Auth SDK persists the token response as session cookies. Google API
      // credentials are not needed for login: remove them BEFORE SDK storage.
      const body = await response.clone().json();
      if (body && typeof body === "object" && ("provider_token" in body || "provider_refresh_token" in body)) {
        delete body.provider_token;
        delete body.provider_refresh_token;
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        return new Response(JSON.stringify(body), { status: response.status, statusText: response.statusText, headers });
      }
    }
    return response;
  } catch {
    // A safe service response also prevents SDK network logs containing URLs.
    return new Response(JSON.stringify({ message: "Service unavailable" }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }
};
