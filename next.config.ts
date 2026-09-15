import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exact LAN hostname only; this setting affects development endpoints.
  ...(process.env.NODE_ENV === "development" ? { allowedDevOrigins: ["10.10.33.202"] } : {}),
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    }];
  },
};

export default nextConfig;
