import { bindings, defineConfig, exports, triggers } from 'cf/config';

export default defineConfig(({ isPreview }) => ({
  accountId: '9d38d6df51b1822215655c1a96ba0626',
  worker: {
    name: 'imaxnearme-fetch-venues',
    entrypoint: 'index.ts',
    compatibilityDate: '2026-10-04',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: false,
    previewUrls: false,
    observability: { enabled: true, headSamplingRate: 1 },
    triggers: isPreview ? [] : [triggers.scheduled({ schedule: '0 6 1,15 * *' })],
    exports: { FetchVenues: exports.workflow({ name: 'imaxnearme-fetch-venues' }) },
    env: {
      DATA: bindings.r2({ name: 'imaxnearme-data' }),
      GOOGLE_PLACES_API_KEY: bindings.secret(),
      FETCH_VENUES: bindings.workflow({
        name: 'imaxnearme-fetch-venues', worker: 'imaxnearme-fetch-venues', exportName: 'FetchVenues',
      }),
    },
  },
}));
