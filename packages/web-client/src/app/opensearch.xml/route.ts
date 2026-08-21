import { NextResponse } from 'next/server';

import { APP_NAME, SITE_URL } from '../app.constants';

/**
 * The OpenSearch descriptor that turns `wizda.app` into an address-bar search
 * engine — type the site's domain, hit Tab, and search without opening the
 * page first (Chrome/Edge/Firefox all support this via `<link rel="search">`,
 * declared in `[lang]/layout.tsx`).
 *
 * Static and language-less on purpose: the `Url` template always points at the
 * unprefixed `/junks`, and the middleware's 307 resolves each searcher into
 * their own locale from there — the same reasoning as the locale-less PWA
 * manifest (see `docs/i18n.md`).
 *
 * `ShortName` must stay in sync with the `<link title>` in the layout — some
 * browsers (Firefox) reject the engine if the two disagree.
 */
export const dynamic = 'force-static';

const DESCRIPTOR = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>${APP_NAME}</ShortName>
  <Description>Search ${APP_NAME}'s junk list</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/svg+xml">${SITE_URL}/icon.svg</Image>
  <Url type="text/html" method="get" template="${SITE_URL}/junks?q={searchTerms}"/>
  <moz:SearchForm>${SITE_URL}/junks</moz:SearchForm>
</OpenSearchDescription>
`;

export function GET(): NextResponse {
  return new NextResponse(DESCRIPTOR, {
    headers: {
      'Content-Type': 'application/opensearchdescription+xml; charset=utf-8',
    },
  });
}
