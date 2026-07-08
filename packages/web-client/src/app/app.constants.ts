import { TsUtilities } from '@shared/tsUtilities';

export const APP_NAME = 'Wizda';
export const PAGE_TITLE_SUFFIX = ` — ${APP_NAME}`;

/** The junk-guarantee tool's display name (the app itself stays "Wizda"). */
export const ORACLE_NAME = 'Junk Oracle';

/** Wizda's one-line, in-character intro for the tool (and its menu tooltip). */
export const ORACLE_TAGLINE = "Want to know how much junk you need for that shiny 4★ axe?";

export const APP_DESCRIPTION = TsUtilities.stringJoin([
  "Work out how much junk to farm to guarantee the item you want in",
  "Wizardry Variants Daphne.",
]);

/** External "support the project" link — swap for the real Ko-fi/BMAC URL later. */
export const SUPPORT_URL = 'https://ko-fi.com';

/** Where the drop-rate data is scraped from (credited on the About page). */
export const DATA_SOURCE_URL = 'https://wizardry.info/daphne/';
