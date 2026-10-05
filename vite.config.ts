import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Relative base so one dist/ works on a GitHub Pages subpath and inside the itch.io iframe.
  base: './',
  build: {
    rolldownOptions: {
      // log.info/log.debug are no-ops in production; marking them pure drops the calls and their
      // message strings from the bundle too.
      treeshake: mode === 'production' ? { manualPureFunctions: ['log.info', 'log.debug'] } : {},
    },
  },
}));
