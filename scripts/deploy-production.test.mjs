import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const script = fileURLToPath(new URL('./deploy-production.mjs', import.meta.url));

test('production deploy passes a private secrets file and removes it even on failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'imax-deploy-test-'));
  try {
    const report = join(directory, 'report.json');
    // This fake cf executable never contacts Cloudflare or deploys anything.
    await writeFile(join(directory, 'cf'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const file = args[args.indexOf('--secrets-file') + 1];
fs.writeFileSync(process.env.TEST_REPORT, JSON.stringify({
  args, file, mode: fs.statSync(file).mode & 0o777,
  key: JSON.parse(fs.readFileSync(file)).GOOGLE_PLACES_API_KEY,
}));
process.exit(7);
`, { mode: 0o700 });
    await assert.rejects(run(process.execPath, [script], {
      env: {
        ...process.env, PATH: directory + delimiter + process.env.PATH,
        GOOGLE_PLACES_API_KEY: 'synthetic-test-key', TEST_REPORT: report,
      },
    }), error => error.code === 7);
    const result = JSON.parse(await readFile(report, 'utf8'));
    assert.deepEqual(result.args.slice(0, 4), ['deploy', '--prebuilt', '--mode', 'production']);
    assert.equal(result.mode, 0o600);
    assert.equal(result.key, 'synthetic-test-key');
    assert.ok(!result.args.includes(result.key));
    await assert.rejects(stat(result.file), error => error.code === 'ENOENT');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
