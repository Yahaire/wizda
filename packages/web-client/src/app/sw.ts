import { defaultCache } from '@serwist/next/worker';
import type {
  PrecacheEntry,
  SerwistGlobalConfig,
} from 'serwist';
import {
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';

// This file is compiled by Serwist (not the app tsconfig — it's excluded there).
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // The junk/equipment lists rarely change — serve instantly from cache and
      // refresh in the background. Never cache the POST guarantee query.
      matcher: ({ url, request }) => (
        request.method === 'GET'
        && (url.pathname === '/api/junks' || url.pathname === '/api/equipment')
      ),
      handler: new StaleWhileRevalidate({ cacheName: 'wizda-api-lists' }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
