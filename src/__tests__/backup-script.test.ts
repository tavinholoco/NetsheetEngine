/**
 * Revisão pós-D (R.10) — as travas do script de backup
 * =====================================================
 * O dump carrega dado pessoal (auth.users, perfis, mensagens diretas) e o
 * repositório é público. O que se testa aqui é o que protege isso: o destino
 * nunca cai dentro do repo, nenhum dump anterior é sobrescrito, e a contagem de
 * linhas por tabela — a conferência do dump — funciona sem ler o conteúdo.
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { countCopyRows, dayFolder, isInside } from '../../scripts/backup-db';

describe('isInside — o dump nunca vai para dentro do repositório', () => {
  const repo = path.resolve('/projetos/NetSheet Engine');
  it('a raiz do repo e qualquer pasta dele contam como dentro', () => {
    expect(isInside(repo, repo)).toBe(true);
    expect(isInside(path.join(repo, 'backups'), repo)).toBe(true);
    expect(isInside(path.join(repo, 'docs', 'x'), repo)).toBe(true);
  });
  it('pasta irmã, com nome parecido, e a pasta do usuário ficam fora', () => {
    expect(isInside(path.resolve('/projetos/NetSheet Engine-backups'), repo)).toBe(false);
    expect(isInside(path.resolve('/projetos'), repo)).toBe(false);
    expect(isInside(path.join(os.homedir(), 'netsheet-backups'), repo)).toBe(false);
  });
  it.runIf(process.platform === 'win32')('no Windows, a caixa não abre brecha', () => {
    expect(isInside('C:\\PROJETOS\\netsheet engine\\bkp', 'C:\\Projetos\\NetSheet Engine')).toBe(true);
  });
});

describe('countCopyRows — conferir o dump sem ler o dado', () => {
  const dump = [
    '-- dump',
    'SET session_replication_role = replica;',
    'COPY "auth"."users" ("id", "email") FROM stdin;',
    'a\tx@y',
    'b\tz@w',
    '\\.',
    '',
    'COPY "public"."character_sheets" ("id", "data") FROM stdin;',
    '1\t{}',
    '\\.',
    'COPY "public"."rooms" ("code") FROM stdin;',
    '\\.'
  ].join('\r\n');

  it('conta as linhas de cada tabela, inclusive as vazias', () => {
    expect(countCopyRows(dump)).toEqual({
      'auth.users': 2,
      'public.character_sheets': 1,
      'public.rooms': 0
    });
  });
  it('dump sem COPY não inventa tabela', () => {
    expect(countCopyRows('INSERT INTO x VALUES (1);')).toEqual({});
  });
});

describe('dayFolder — nunca sobrescreve um dump anterior', () => {
  it('uma pasta por dia; no segundo dump do mesmo dia, sufixo -2', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'netsheet-bkp-'));
    const dia = new Date('2026-09-29T12:00:00Z');
    const primeira = dayFolder(root, dia);
    expect(path.basename(primeira)).toBe('2026-09-29');
    fs.mkdirSync(primeira);
    expect(path.basename(dayFolder(root, dia))).toBe('2026-09-29-2');
    fs.rmSync(root, { recursive: true, force: true });
  });
});
