import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

// https://github.com/cloudflare/cf/issues/185
// Workers Builds still reads this output protocol even when deployment uses cf.
export async function writePreviewOutput(result, directory, workerName, explicitPath) {
  if (!directory && !explicitPath) return;
  if (result.type !== 'preview' || !Array.isArray(result.preview_urls) || !result.preview_urls.length) {
    throw new Error('cf did not return a valid preview deployment result');
  }
  const timestamp = new Date().toISOString();
  const date = timestamp.replaceAll(':', '-').replace('.', '_').replace('T', '_').replace('Z', '');
  const file = explicitPath || join(directory, `wrangler-output-${date}-${randomBytes(3).toString('hex')}.json`);
  await mkdir(dirname(file), { recursive: true });
  const entry = { ...result, worker_name: workerName, timestamp };
  await appendFile(file, JSON.stringify(entry) + '\n');
  return file;
}
