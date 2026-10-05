"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressListener({ onSettled }: { onSettled: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onSettled();
  }, [pathname, searchParams, onSettled]);

  return null;
}

export function NavigationProgress() {
  const [isNavigating, setIsNavigating] = useState(false);
  const handleSettled = useCallback(() => {
    setIsNavigating(false);
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.defaultPrevented
      ) {
        return;
      }

      try {
        const targetUrl = new URL(anchor.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        if (
          targetUrl.origin === currentUrl.origin &&
          (targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search)
        ) {
          setIsNavigating(true);
        }
      } catch {
        // Ignore URL parsing errors
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!isNavigating) return;
    const timer = window.setTimeout(() => {
      setIsNavigating(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, [isNavigating]);

  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgressListener onSettled={handleSettled} />
      </Suspense>
      {isNavigating && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Memuat navigasi..."
          className="nav-progress-bar"
        >
          <span className="sr-only">Memuat halaman...</span>
        </div>
      )}
    </>
  );
}
