/**
 * K.7a — AS PERÍCIAS POR ATRIBUTO, PELAS FONTES (RUL-12)
 * =====================================================
 * A lista de pickup do S3 (p. 4) e o `default-skills.db` do S8 dão as mesmas
 * perícias, e o S2 confirma (conferência): INT ganha Accounting, Anthropology,
 * Gamble, Shadow/Track e Wilderness Survival; COOL, Interrogation; TECH,
 * Cyberdeck Design e Pharmaceuticals. "Psychology" não existe em nenhuma, e
 * "Social" é só de EMP. As duas dão quatro perícias de piloto, não uma "à
 * escolha". E toda perícia dos pacotes de carreira da K.6 tem de estar na lista,
 * no atributo do pacote.
 */
import { describe, it, expect } from 'vitest';
import { SKILL_TABLES } from '../data/cyberpunkData';
import { normalizeName } from '../rules/combat';
import { CAREER_PACKAGES } from '../rules/tables';
import type { StatName } from '../types/cyberpunk';

const STATS = Object.keys(SKILL_TABLES) as StatName[];
const norm = (name: string) => normalizeName(name.replace('(escolha)', ''));
const statsOf = (name: string) => STATS.filter((stat) => SKILL_TABLES[stat].some((s) => norm(s) === norm(name)));

const ENTRAM: [string, StatName][] = [
  ['Accounting', 'INT'],
  ['Anthropology', 'INT'],
  ['Gamble', 'INT'],
  ['Shadow / Track', 'INT'],
  ['Wilderness Survival', 'INT'],
  ['Interrogation', 'COOL'],
  ['Cyberdeck Design', 'TECH'],
  ['Pharmaceuticals', 'TECH']
];

describe('K.7a — o SKILL_TABLES pelas fontes', () => {
  it.each(ENTRAM)('%s está em %s', (name, stat) => {
    expect(statsOf(name)).toEqual([stat]);
  });

  it('"Psychology" não existe, e "Social" é só de EMP', () => {
    expect(statsOf('Psychology')).toEqual([]);
    expect(statsOf('Social')).toEqual(['EMP']);
  });

  it('as quatro perícias de piloto, em REF, no lugar do "Pilot (escolha)"', () => {
    for (const p of ['Pilot (Gyro)', 'Pilot (Fixed Wing)', 'Pilot (Dirigible)', 'Pilot (Vectored Thrust)']) {
      expect(statsOf(p), p).toEqual(['REF']);
    }
    expect(SKILL_TABLES.REF).not.toContain('Pilot (escolha)');
  });

  it('nenhuma perícia aparece duas vezes, nem em dois atributos', () => {
    const all = STATS.flatMap((stat) => SKILL_TABLES[stat].map(norm));
    expect(new Set(all).size).toBe(all.length);
  });

  it('toda perícia dos pacotes de carreira (K.6) está na lista, no atributo do pacote', () => {
    for (const pkg of CAREER_PACKAGES) {
      for (const skill of [...pkg.skills, ...(pkg.choices ?? []).flatMap((c) => c.options)]) {
        expect(statsOf(skill.name), `${pkg.role}: ${skill.name}`).toEqual([skill.stat]);
      }
    }
  });
});
