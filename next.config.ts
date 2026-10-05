import type { NextConfig } from "next";

const FIREBASE_AUTH_HOST = "https://school-planner-8fd73.firebaseapp.com";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets open tabs / home-screen apps notice a newer deploy (components/update-check.tsx).
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev" },
  // Lets the app serve Firebase's auth handler from its own origin, so Google
  // sign-in works inside an iOS home-screen app (see README → "iOS sign-in").
  async rewrites() {
    return [
      { source: "/__/firebase/init.json", destination: "/api/firebase-init" },
      { source: "/__/auth/:path*", destination: `${FIREBASE_AUTH_HOST}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `${FIREBASE_AUTH_HOST}/__/firebase/:path*` },
    ];
  },
  async redirects() {
    return [{ source: "/today", destination: "/", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Google sign-in popups need to talk back to the opener.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
