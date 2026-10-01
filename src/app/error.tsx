"use client";

// The parent boundary also catches failures while resolving dashboard context.
// Reuse the safe F2 error UI; never render the received error or digest.
export { default } from "./dashboard/error";
