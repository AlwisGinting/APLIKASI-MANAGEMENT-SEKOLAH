import "server-only";
import { headers } from "next/headers";

export async function authOrigin() {
  const requestHeaders = await headers();
  const value = requestHeaders.get("origin");
  if (!value) throw new Error("Invalid auth origin");
  const origin = new URL(value);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!["http:", "https:"].includes(origin.protocol) || origin.host !== host || origin.username || origin.password || origin.origin !== value) throw new Error("Invalid auth origin");
  return origin.origin;
}
