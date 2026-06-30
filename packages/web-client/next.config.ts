import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
