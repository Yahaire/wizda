import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/** Fetch the raw HTML, from a local file if the source looks like a path, else over HTTP. */
export async function loadHtml(source: string): Promise<string> {
  if (existsSync(source)) {
    return readFile(source, 'utf-8');
  }
  const res = await fetch(source);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${source}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}
