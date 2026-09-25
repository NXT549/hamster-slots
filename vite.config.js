// vite.config.js — settings for Vite, the tool that runs the game while you work
// on it (`npm run dev`) and builds the version players get (`npm run build` → dist/).

import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths in the build, so the same dist/ folder works from anywhere:
  // a GitHub Pages sub-path (/repo-name/), an itch.io iframe, or inside a
  // desktop/mobile app later.
  base: './',
  server: {
    // Port 8765 is where the game has always run. Browsers keep one save per
    // address + port, so staying on it keeps the player's save.
    port: 8765,
    strictPort: true, // if 8765 is busy, stop with a message instead of quietly picking another port
  },
  // Vitest (`npm test`) reads this file too. The tests live in tests/.
  test: {
    include: ['tests/**/*.test.js'],
  },
});
