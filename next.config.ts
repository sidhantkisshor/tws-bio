import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework via the X-Powered-By header
  poweredByHeader: false,
  // Baseline security headers applied to every route. Route Handlers that set
  // their own headers (e.g. the /[shortCode] deep-link interstitial, which sets
  // a stricter CSP + X-Frame-Options on its own Response) take precedence on
  // that response, so this global set never weakens them.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
