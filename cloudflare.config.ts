import { defineConfig, triggers } from 'cf/config';

export default defineConfig(({ isPreview }) => ({
  accountId: '9d38d6df51b1822215655c1a96ba0626',
  worker: {
    name: '70mm',
    compatibilityDate: '2026-10-04',
    assets: { notFoundHandling: 'single-page-application' },
    workersDev: isPreview,
    previewUrls: true,
    triggers: isPreview ? [] : [triggers.fetch({ pattern: 'imaxnearme.com/*', zone: 'imaxnearme.com' })],
    observability: { enabled: true, headSamplingRate: 1 },
  },
}));
