/**
 * L.2 (ARQ-04) — o React e o Supabase em chunks próprios
 * =======================================================
 * Medido na L.0: o chunk de entrada tinha 620 kB / 184 kB gzip, e o Supabase
 * era 214 kB / 56 kB gzip dele, o React 190 kB / 59 kB gzip. O `App.tsx` importa
 * o `auth` no boot, então separar não tira o Supabase da primeira carga; o ganho
 * é de cache: um deploy muda o código do app, não as bibliotecas, e quem volta
 * baixa só o chunk do app.
 *
 * O teste trava a regra de separação; o tamanho de cada chunk se mede no build
 * (o plano registra o número).
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { vendorChunk } from '../../vite.config';

describe('L.2 — a regra dos chunks das bibliotecas', () => {
  it('o Supabase inteiro vai para o chunk dele, com o caminho do Windows ou do Linux', () => {
    for (const id of [
      '/repo/node_modules/@supabase/supabase-js/dist/module/index.js',
      '/repo/node_modules/@supabase/auth-js/dist/module/GoTrueClient.js',
      '/repo/node_modules/@supabase/realtime-js/dist/module/RealtimeClient.js',
      '/repo/node_modules/iceberg-js/dist/index.mjs',
      'C:\\repo\\node_modules\\@supabase\\storage-js\\dist\\index.js'
    ]) {
      expect(vendorChunk(id)).toBe('vendor-supabase');
    }
  });

  it('o React, o react-dom e o scheduler vão para o chunk do React', () => {
    for (const id of [
      '/repo/node_modules/react/cjs/react.production.js',
      '/repo/node_modules/react-dom/cjs/react-dom-client.production.js',
      '/repo/node_modules/scheduler/cjs/scheduler.production.js'
    ]) {
      expect(vendorChunk(id)).toBe('vendor-react');
    }
  });

  it('o resto fica com o Rollup: o código do app e as bibliotecas que só uma tela carrega', () => {
    for (const id of [
      '/repo/src/App.tsx',
      '/repo/src/lib/supabase.ts',
      '/repo/node_modules/yjs/dist/yjs.mjs',
      '/repo/node_modules/react-router/dist/index.js',
      '/repo/node_modules/react-remove-scroll/dist/es2015/index.js',
      '/repo/node_modules/@radix-ui/react-dialog/dist/index.mjs'
    ]) {
      expect(vendorChunk(id)).toBeUndefined();
    }
  });
});
