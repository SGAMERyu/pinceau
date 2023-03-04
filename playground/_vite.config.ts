import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import Vue from '@vitejs/plugin-vue'
import { join, resolve } from 'pathe'
import Pinceau from '../src/vite'

const from = 'src'
const ext = '.ts'

export default defineConfig({
  logLevel: 'info',
  resolve: {
    alias: {
      'pinceau/runtime': resolve(__dirname, `../${from}/runtime${ext}`),
      'pinceau': resolve(__dirname, `../${from}/index${ext}`),
    },
    dedupe: ['vue', '@vue/*', 'vue/*'],
  },
  plugins: [
    Inspect({
      dev: true,
    }),
    Pinceau({
      buildDir: join(__dirname, './.nuxt/pinceau/'),
      configLayers: [
        {
          cwd: resolve(__dirname, './theme'),
        },
      ],
      debug: true,
      studio: true,
      definitions: true,
      runtime: true,
      colorSchemeMode: 'class',
    }),
    Vue(),
  ],
})
