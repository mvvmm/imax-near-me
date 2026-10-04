import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { writePreviewOutput } from './preview-output.mjs';

test('writes the preview URLs and metadata required by Workers Builds', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'imax-preview-'));
  try {
    const result = { type: 'preview', version: 1, preview_id: 'id', preview_name: 'feature', preview_urls: ['https://feature.example.com'], deployment_urls: ['https://deployment.example.com'] };
    await writePreviewOutput(result, directory, '70mm');
    const files = await readdir(directory);
    assert.match(files[0], /^wrangler-output-.*\.json$/);
    const entry = JSON.parse(await readFile(join(directory, files[0]), 'utf8'));
    assert.deepEqual(entry.preview_urls, result.preview_urls);
    assert.deepEqual(entry.deployment_urls, result.deployment_urls);
    assert.equal(entry.worker_name, '70mm');
    assert.ok(Number.isFinite(Date.parse(entry.timestamp)));
  } finally { await rm(directory, { recursive: true }); }
});

test('rejects malformed preview results before writing a misleading Builds entry', async () => {
  await assert.rejects(writePreviewOutput({ type: 'preview', preview_urls: [] }, '/unused', '70mm'), /valid preview/);
  await writePreviewOutput({}, undefined, '70mm');
});
