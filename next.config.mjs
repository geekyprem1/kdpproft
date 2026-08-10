/** @type {import('next').NextConfig} */

// Derive the Supabase origin so the CSP can allow the browser to reach Supabase
// (auth, REST, storage signed URLs, realtime websocket) without wildcarding.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supabaseOrigin = "https://*.supabase.co";
try {
  if (supabaseUrl) supabaseOrigin = new URL(supabaseUrl).origin;
} catch {
  /* keep wildcard fallback */
}
const supabaseWs = supabaseOrigin.replace(/^https/, "wss");

// Content-Security-Policy. 'unsafe-inline'/'unsafe-eval' on script-src are required
// by Next.js' inline hydration runtime (no nonce middleware in this app). The value
// is still meaningful: it locks resources to self + Supabase, forbids framing, plugins,
// and arbitrary base/form targets.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // puppeteer is only used in scripts / future server tasks, never bundled into the client
  serverExternalPackages: ["puppeteer"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
