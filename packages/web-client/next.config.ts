import type { NextConfig } from "next";

import withSerwistInit from '@serwist/next';
import dotenv from 'dotenv';
import path from 'path';

// Load root .env file
dotenv.config({
  path: path.resolve(__dirname, '../../.env')
});

const apiBaseUrl = process.env.API_URL;

if (!apiBaseUrl) {
  throw new Error('API_URL environment variable is not set');
}

// Umami first-party proxy targets (optional). When set, `/umami/*` is served
// same-origin so ad-blockers don't drop the analytics script/beacon.
const umamiScriptUrl = process.env.UMAMI_SCRIPT_URL;
const umamiCollectUrl = process.env.UMAMI_COLLECT_URL;
// The path the tracker script itself POSTs to is baked in at the Umami
// instance's own build time (its `COLLECT_API_ENDPOINT`), not something we
// control — so the rewrite source must mirror whatever that instance uses,
// not assume Umami's `/api/send` default.
const umamiCollectPath = process.env.UMAMI_COLLECT_PATH || '/api/send';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The web-client imports runtime values (enums, catalogs) from the sibling
  // `@wizda/shared` package via the `@shared/*` alias. Let Next compile that TS.
  transpilePackages: ['@wizda/shared'],
  experimental: {
    // `react-icons/gi` is a ~4000-icon barrel; we import ~32. Rewrite the barrel
    // import to direct ones so the rest never reaches the bundle.
    optimizePackageImports: ['react-icons/gi'],
  },
  async rewrites() {
    const rules = [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
    if (umamiScriptUrl && umamiCollectUrl) {
      rules.push(
        {
          source: '/umami/script.js',
          destination: umamiScriptUrl,
        },
        {
          source: `/umami${umamiCollectPath}`,
          destination: umamiCollectUrl,
        },
      );
    }
    return rules;
  },
};

// Service worker built by Serwist for production only — leaves `next dev
// --turbopack` untouched (Serwist is a webpack-time plugin).
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
});

export default withSerwist(nextConfig);
