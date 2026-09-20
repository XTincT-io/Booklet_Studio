/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained .next/standalone build (only the files actually needed at
  // runtime, deps pruned) — required by Dockerfile's production image. See
  // https://nextjs.org/docs/pages/api-reference/next-config-js/output
  output: "standalone",
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
  },
  async headers() {
    // A "baseline" CSP, not a strict one — see the comment below for exactly why, and
    // README.md's "Known security exceptions" for the full writeup. This is a real,
    // meaningful improvement over no CSP at all (blocks loading scripts/styles/frames
    // from untrusted external origins, blocks <object>/<embed>-based exploits, restricts
    // form-action/base-uri hijacking) even though it isn't the strict nonce-based CSP
    // this app would need to also block inline-script injection specifically.
    const csp = [
      "default-src 'self'",
      // 'unsafe-inline' here is a deliberate, documented compromise, not an oversight:
      // Next.js's App Router injects inline <script> tags for hydration/RSC data as a
      // fundamental part of how it works — without 'unsafe-inline' (or full nonce
      // wiring through middleware.ts, which risks the auth-gating logic that lives
      // there), the app simply fails to hydrate. This still blocks loading scripts from
      // any *external* untrusted origin, which is the more common real-world XSS
      // follow-up (exfiltration/payload-loading), even though it can't block inline
      // script injection itself.
      "script-src 'self' 'unsafe-inline'",
      // Same compromise, for a different reason: this codebase uses inline `style={{}}`
      // React props extensively (see components/BookletApp.tsx), which CSP's style-src
      // treats the same as inline <style> blocks. Eliminating this means migrating the
      // whole app to CSS modules/classes — a large, separate refactor, not something to
      // fold into a security-headers pass.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:", // https: is broad, but S3 bucket domains vary per deployment
      "media-src 'self' https:", // audio playback from S3
      "font-src 'self' data:",
      "connect-src 'self' https:", // https: needed for direct-to-S3 presigned uploads (different origin than the app)
      "frame-ancestors 'self'", // consistent with X-Frame-Options: SAMEORIGIN below, not a new restriction
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        // Applies to every route except the exported web-viewer bundle's own assets
        // (those are static files served from S3, not from this app).
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS only matters over HTTPS anyway; harmless to send in dev over HTTP since
          // browsers ignore it there, but only actually enforced once you're on TLS.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
