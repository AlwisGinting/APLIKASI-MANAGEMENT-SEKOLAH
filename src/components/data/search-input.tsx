"use client";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const DEBOUNCE_MS = 300;

/**
 * Progressive enhancement: attaches a ~300 ms debounced `input` listener to
 * the search input already SSR'd in DataToolbar.  Identified by `inputId` so
 * no DOM restructuring is needed and the static SSR output is unchanged.
 *
 * URL params are read from `window.location.search` inside useEffect (client
 * only) to avoid calling useSearchParams during render, which is not available
 * in the Node test environment.
 */
export function SearchInputEnhancer({ inputId }: { inputId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;

    function handleInput(event: Event) {
      const next = (event.target as HTMLInputElement).value;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Read current params at dispatch time (captures latest filter/sort state).
        const params = new URLSearchParams(window.location.search);
        if (next.trim()) {
          params.set("q", next.trim());
        } else {
          params.delete("q");
        }
        params.set("page", "1");
        router.push(`${pathname}?${params.toString()}`);
      }, DEBOUNCE_MS);
    }

    input.addEventListener("input", handleInput);
    return () => {
      input.removeEventListener("input", handleInput);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inputId, pathname, router]);

  // Renders nothing — pure behaviour attachment.
  return null;
}
