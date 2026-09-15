import type { NextConfig } from 'next';

// The service worker must never be served from cache: a stale copy would keep
// its own caching rules alive after a deploy that changed them.
const SERVICE_WORKER_HEADERS = [
  { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
  { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
];

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/(.*)', headers: SECURITY_HEADERS },
      { source: '/sw.js', headers: SERVICE_WORKER_HEADERS },
    ];
  },
};

export default nextConfig;
