/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [],
  },
  // No /api rewrite: the axios client (src/lib/api.ts) calls the API directly at
  // NEXT_PUBLIC_API_BASE_URL, and the server allows the client origin via CORS.
  // If you later want same-origin requests (e.g. to move the refresh token into
  // an httpOnly cookie), add a rewrite from '/api/:path*' to the API *origin*
  // (not the full /api/v1 base) and point the axios baseURL at '/api/v1'.
};

module.exports = nextConfig;
