#!/usr/bin/env node
/**
 * Bundles the chat-bubble extension into a single flat chat.js.
 *
 * Shopify CDN for theme extensions only serves files directly under assets/ —
 * subdirectories (e.g. assets/modules/) return 404. This script inlines all
 * ES module imports so the deployed chat.js is self-contained.
 */

import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const assetsDir = join(root, 'extensions/chat-bubble/assets');

await esbuild.build({
  entryPoints: [join(assetsDir, 'chat.src.js')],
  bundle: true,
  format: 'iife',
  outfile: join(assetsDir, 'chat.js'),
  minify: process.env.NODE_ENV === 'production',
  logLevel: 'info',
});
