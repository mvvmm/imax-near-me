import { bindings, defineConfig, exports, triggers } from 'cf/config';

export default defineConfig(({ isPreview }) => ({
  accountId: '9d38d6df51b1822215655c1a96ba0626',
  worker: {
    name: '70mm',
    entrypoint: 'worker/index.ts',
    compatibilityDate: '2026-10-04',
    compatibilityFlags: ['nodejs_compat'],
    assets: { notFoundHandling: 'single-page-application' },
    workersDev: isPreview,
    previewUrls: true,
    triggers: isPreview ? [] : [
      triggers.fetch({ pattern: 'imaxnearme.com/*', zone: 'imaxnearme.com' }),
      triggers.scheduled({ schedule: '0 6 1,15 * *' }),
    ],
    exports: { FetchVenues: exports.workflow({ name: 'imaxnearme-venues' }) },
    env: {
      ASSETS: bindings.assets(),
      DATA: bindings.r2({ name: 'imaxnearme-data' }),
      GOOGLE_PLACES_API_KEY: isPreview ? bindings.text('') : bindings.secret(),
      FETCH_VENUES: bindings.workflow({ name: 'imaxnearme-venues', worker: '70mm', exportName: 'FetchVenues' }),
    },
    observability: { enabled: true, headSamplingRate: 1 },
  },
}));
