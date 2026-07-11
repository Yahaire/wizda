'use client';

import { useEffect } from 'react';

import { VERSION_LABEL } from '@shared/generated/version';

// Renders nothing — logs the running build once to the browser console so you
// can peek at what's live from devtools. The module-level guard keeps
// StrictMode's dev double-mount from logging twice.
let logged = false;

export function VersionLog() {
  useEffect(() => {
    if (logged) {
      return;
    }
    logged = true;
    console.log(`Running Wizda web-client ${VERSION_LABEL}`);
  }, []);

  return null;
}
