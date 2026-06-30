import { execSync } from 'child_process';
import { unlinkSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const flagPath = resolve(__dirname, '../.maintenance');

console.log('Setting maintenance mode...');
writeFileSync(flagPath, '');

try {
  console.log('Running seed...');
  execSync('npx prisma db seed', { stdio: 'inherit' });
} catch (error) {
  console.error('Seed failed. Maintenance mode left active to avoid serving a broken app.');
  console.error('Fix the issue, re-run the seed, then remove .maintenance manually if needed.');
  process.exit(1);
}

unlinkSync(flagPath);
console.log('Maintenance mode cleared.');
