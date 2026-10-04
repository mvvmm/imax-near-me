import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// https://github.com/cloudflare/cf/issues/185
// Workers Builds still reads this output protocol even when deployment uses cf.
export async function writePreviewOutput(result, directory, workerName) {
  if (!directory) return;
  if (result.type !== 'preview' || !Array.isArray(result.preview_urls) || !result.preview_urls.length) {
    throw new Error('cf did not return a valid preview deployment result');
  }
  await mkdir(directory, { recursive: true });
  const entry = { ...result, worker_name: workerName, timestamp: new Date().toISOString() };
  await appendFile(join(directory, `wrangler-output-${Date.now()}-${process.pid}.json`), JSON.stringify(entry) + '\n');
}
