import { TsUtilities } from '@shared/tsUtilities';

export const APP_NAME = 'Wizda';
export const PAGE_TITLE_SUFFIX = ` — ${APP_NAME}`;

/** The junk-guarantee tool's display name (the app itself stays "Wizda"). */
export const ORACLE_NAME = 'Junk Oracle';

export const APP_DESCRIPTION = TsUtilities.stringJoin([
  "Work out how much junk to farm to guarantee the item you want in",
  "Wizardry Variants Daphne.",
]);

/** External "support the project" link — swap for the real Ko-fi/BMAC URL later. */
export const SUPPORT_URL = 'https://ko-fi.com';

/** Where the drop-rate data is scraped from (credited on the About page). */
export const DATA_SOURCE_URL = 'https://wizardry.info/daphne/';

/** The public repo. Corrections and contributions land here. */
export const REPO_URL = 'https://github.com/Yahaire/wizda';
export const ISSUES_URL = `${REPO_URL}/issues`;

// Deep links to the committed docs, so anyone can check our work. `HEAD`
// resolves to the default branch, surviving a future rename.
const DOCS_URL = `${REPO_URL}/blob/HEAD/docs`;
/** The full derivation of every number the Junk Oracle prints. */
export const CALCULATION_DOC_URL = `${DOCS_URL}/calculation.md`;
/** The game model + how the source's drop tables are shaped. */
export const DOMAIN_DOC_URL = `${DOCS_URL}/domain.md`;
