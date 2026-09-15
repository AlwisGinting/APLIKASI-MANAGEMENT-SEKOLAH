/** Bound backend waits and prevent private responses entering the fetch cache. */
export const supabaseFetch: typeof fetch = async (input, init) => {
  const timeout = AbortSignal.timeout(12_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    return await fetch(input, { ...init, cache: "no-store", signal });
  } catch {
    // A safe service response also prevents SDK network logs containing URLs.
    return new Response(JSON.stringify({ message: "Service unavailable" }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }
};
