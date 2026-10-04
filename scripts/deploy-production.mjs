import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Workers Builds supplies this production-only secret on merge. Pass it through
// a private file rather than command-line arguments or build artifacts.
let directory;
try {
  const args = ['deploy', '--prebuilt', '--mode', 'production'];
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (key) {
    directory = await mkdtemp(join(tmpdir(), 'imax-secrets-'));
    const file = join(directory, 'secrets.json');
    await writeFile(file, JSON.stringify({ GOOGLE_PLACES_API_KEY: key }), { mode: 0o600 });
    args.push('--secrets-file', file);
  }
  const code = await new Promise((resolve, reject) => {
    const child = spawn('cf', [...args, ...process.argv.slice(2)], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', code => resolve(code ?? 1));
  });
  process.exitCode = code;
} finally {
  if (directory) await rm(directory, { recursive: true, force: true });
}
