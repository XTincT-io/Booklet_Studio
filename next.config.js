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
    return [
      {
        // Applies to every route except the exported web-viewer bundle's own assets
        // (those are static files served from S3, not from this app).
        source: "/:path*",
        headers: [
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
