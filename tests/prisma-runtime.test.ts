import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';

test('the real Prisma client boots with Temporal support and a compatible emitted contract', () => {
  const output = execFileSync(
    process.execPath,
    [
      '-e',
      "import './src/prisma/db.ts'; const instant = globalThis.Temporal.Instant.from('2026-10-14T00:00:00Z'); if (instant.toString() !== '2026-10-14T00:00:00Z') throw Error('Temporal failed'); console.log('runtime-ok'); process.exit(0);",
    ],
    { encoding: 'utf8', timeout: 30000 },
  );
  expect(output).toContain('runtime-ok');
});
