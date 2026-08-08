/**
 * Fase 6 (T6.4) — UNIT TESTS DO MOTOR DE DADOS (src/utils/diceEngine.ts)
 * =====================================================================
 * RNG DETERMINÍSTICO: o engine global da lib (@dice-roller/rpg-dice-roller)
 * é substituído por uma FILA de valores controlada, o que permite asserts
 * EXATOS de explosão, fumble, faixas de dano e death save.
 *
 * Mapeamento comprovado empiricamente (downscale do lib):
 *   d10 = (engineValue % 10) + 1   (valor 0 → 1, valor 9 → 10)
 *   d6  = (engineValue % 6) + 1
 * Valores ≥ 4294967290 são rejeitados pelo lib (loop de downscale) — não usar.
 *
 * Rodar: `npm run test` (tsx scripts/test-dice-engine.ts)
 */
import { DiceRoll, NumberGenerator } from '@dice-roller/rpg-dice-roller';
import { rollSkill, rollDamage, rollDeathSave, rollLocation } from '../src/utils/diceEngine';

// ---------------------------------------------------------------------------
// Harness de asserção (mesmo estilo de scripts/test-ws-e2e.mjs)
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`❌ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

/** Substitui o RNG global por uma fila de valores; restaura nativeMath ao final. */
function withEngine(values: number[], fn: () => void): void {
  const queue = [...values];
  NumberGenerator.generator.engine = {
    next: () => (queue.length > 0 ? (queue.shift() as number) : 0x80000000)
  };
  try {
    fn();
  } finally {
    NumberGenerator.generator.engine = NumberGenerator.engines.nativeMath;
  }
}

/** Conveniência: engine de um só valor (dado único). */
function withEngineOne(value: number, fn: () => void): void {
  withEngine([value], fn);
}

// ---------------------------------------------------------------------------
// 1. Perícia — EXPLOSÃO (1d10!: 10 → +1d10, encadeado)
// ---------------------------------------------------------------------------
withEngine([9, 4], () => {
  // valores 9→10 e 4→5 → 1d10!: [10!, 5] = 15
  const r = rollSkill(8, 3, { characterName: 'Vex', label: 'Rolagem: Handgun', statName: 'REF' });
  check('explosão: isCriticalSuccess', r.isCriticalSuccess === true);
  check('explosão: total = 15 + 8 + 3 = 26', r.total === 26, `total=${r.total}`);
  check('explosão: baseRoll = 10', r.baseRoll === 10, `baseRoll=${r.baseRoll}`);
  check('explosão: bonus = 11', r.bonus === 11, `bonus=${r.bonus}`);
  check('explosão: diceFormula marcada', r.diceFormula === '1d10! (Explodiu!)', r.diceFormula);
  check('explosão: audit trail [10!, 5]', r.details.includes('[10!, 5]'), r.details);
  check('explosão: não é falha crítica', r.isCriticalFailure === false);
});

withEngine([9, 9, 4], () => {
  // 10 → 10 → 5 = 25 (explosão encadeada)
  const r = rollSkill(8, 3);
  check('explosão encadeada: total = 25 + 11 = 36', r.total === 36, `total=${r.total}`);
  check('explosão encadeada: audit trail com 2 explosões', (r.details.match(/10!/g) || []).length >= 2, r.details);
});

// ---------------------------------------------------------------------------
// 2. Perícia — FUMBLE (1: rola 1d10 e SUBTRAI)
// ---------------------------------------------------------------------------
withEngine([0, 3], () => {
  // valores 0→1 (dado) e 3→4 (penalidade) → total = 1 - 4 + 8 + 3 = 8
  const r = rollSkill(8, 3, { characterName: 'Vex', label: 'Rolagem: Handgun', statName: 'REF' });
  check('fumble: isCriticalFailure', r.isCriticalFailure === true);
  check('fumble: total = 1 - 4 + 8 + 3 = 8', r.total === 8, `total=${r.total}`);
  check('fumble: baseRoll = 1', r.baseRoll === 1, `baseRoll=${r.baseRoll}`);
  check('fumble: diceFormula marcada', r.diceFormula === '1d10! (Fumble!)', r.diceFormula);
  check('fumble: detalhe com penalidade -4', r.details.includes('Falha Crítica (1!): -4'), r.details);
  check('fumble: não é sucesso crítico', r.isCriticalSuccess === false);
});

// ---------------------------------------------------------------------------
// 3. Perícia — rolagem normal (sem crítico)
// ---------------------------------------------------------------------------
withEngine([4], () => {
  // valor 4→5 → total = 5 + 8 + 3 = 16
  const r = rollSkill(8, 3, { statName: 'TECH' });
  check('perícia normal: total = 5 + 8 + 3 = 16', r.total === 16, `total=${r.total}`);
  check('perícia normal: sem flags críticas', r.isCriticalSuccess === false && r.isCriticalFailure === false);
  check('perícia normal: diceFormula = 1d10', r.diceFormula === '1d10', r.diceFormula);
  check('perícia normal: statName no detalhe', r.details.includes('TECH (8)'), r.details);
});

// ---------------------------------------------------------------------------
// 4. Dano — fórmula NdM±X + local de impacto (ordem: dados, depois local)
// ---------------------------------------------------------------------------
withEngine([3, 4, 0], () => {
  // 3→4, 4→5 (2d6) +2 = 11; local 0→1 = Cabeça
  const r = rollDamage('2d6+2', { characterName: 'Vex', label: 'Dano da Arma: 9mm' });
  check('dano: total = 4 + 5 + 2 = 11', r.total === 11, `total=${r.total}`);
  check('dano: baseRoll = total', r.baseRoll === 11, `baseRoll=${r.baseRoll}`);
  check('dano: rollType = DAMAGE', r.rollType === 'DAMAGE');
  check('dano: audit trail 2d6+2: [4, 5]+2 = 11', r.details.includes('2d6+2: [4, 5]+2 = 11'), r.details);
  check('dano: local de impacto Cabeça', r.details.includes('Cabeça (1) [DANO DOBRADO X2!]'), r.details);
  check('dano: sem flags críticas', r.isCriticalSuccess === false && r.isCriticalFailure === false);
});

withEngine([5, 4], () => {
  // 1d6 com valor 5→6 e local 4→5 (Braço Direito)
  const r = rollDamage('1d6', { label: 'Dano' });
  check('dano 1d6: total = 6', r.total === 6, `total=${r.total}`);
  check('dano 1d6: local Braço Direito', r.details.includes('Braço Direito (5)'), r.details);
});

// ---------------------------------------------------------------------------
// 5. Death save — 1d10 ≤ BODY
// ---------------------------------------------------------------------------
withEngineOne(3, () => {
  // valor 3→4 ≤ 8 → PASSOU
  const r = rollDeathSave(8, { characterName: 'Vex' });
  check('death save: passou (4 ≤ 8)', r.isCriticalSuccess === true && r.isCriticalFailure === false);
  check('death save: total = 4', r.total === 4, `total=${r.total}`);
  check('death save: detalhe PASSOU', r.details.includes('PASSOU! Resultado 4 ≤ Corpo 8'), r.details);
});

withEngineOne(9, () => {
  // valor 9→10 > 8 → FALHOU
  const r = rollDeathSave(8);
  check('death save: falhou (10 > 8)', r.isCriticalSuccess === false && r.isCriticalFailure === true);
  check('death save: detalhe FALHOU', r.details.includes('FALHOU! Resultado 10 > Corpo 8'), r.details);
});

// ---------------------------------------------------------------------------
// 6. Local de impacto — mapeamento exato
// ---------------------------------------------------------------------------
withEngineOne(0, () => {
  const loc = rollLocation();
  check('local: valor 1', loc.roll === 1, `roll=${loc.roll}`);
  check('local: Cabeça (dano ×2)', loc.name === 'Cabeça (1) [DANO DOBRADO X2!]', loc.name);
});
withEngineOne(4, () => {
  const loc = rollLocation();
  check('local: 5 = Braço Direito', loc.roll === 5 && loc.name === 'Braço Direito (5)', JSON.stringify(loc));
});
withEngineOne(8, () => {
  const loc = rollLocation();
  check('local: 9 = Perna Esquerda', loc.roll === 9 && loc.name === 'Perna Esquerda (9-0)', JSON.stringify(loc));
});

// ---------------------------------------------------------------------------
// 7. RollResult — campos obrigatórios
// ---------------------------------------------------------------------------
withEngineOne(4, () => {
  const r = rollSkill(5, 2, { characterName: 'Choom' });
  check('RollResult: id único', typeof r.id === 'string' && r.id.startsWith('roll_'), r.id);
  check('RollResult: timestamp', typeof r.timestamp === 'string' && r.timestamp.length > 0);
  check('RollResult: characterName', r.characterName === 'Choom', r.characterName);
  check('RollResult: label/diceFormula/details', !!r.label && !!r.diceFormula && !!r.details);
  check('RollResult: total numérico', typeof r.total === 'number');
  check('RollResult: default characterName = Edgerunner', (() => {
    const r2 = rollSkill(1, 1);
    return r2.characterName === 'Edgerunner';
  })());
});

// ---------------------------------------------------------------------------
// 8. Fórmula inválida lança erro (contrato do motor)
// ---------------------------------------------------------------------------
let threwInvalid = false;
try {
  rollDamage('abc');
} catch {
  threwInvalid = true;
}
check('dano: fórmula inválida lança erro', threwInvalid === true);

// ---------------------------------------------------------------------------
// 9. Faixas e distribuição — RNG seedado (MersenneTwister) em massa
// ---------------------------------------------------------------------------
NumberGenerator.generator.engine = NumberGenerator.engines.MersenneTwister19937.seed(1234);
let minDmg = Infinity;
let maxDmg = -Infinity;
let dmgInRange = true;
for (let i = 0; i < 2000; i++) {
  const r = rollDamage('2d6+2');
  minDmg = Math.min(minDmg, r.total);
  maxDmg = Math.max(maxDmg, r.total);
  if (r.total < 4 || r.total > 14) dmgInRange = false;
}
check('dano 2d6+2: faixa 4..14 em 2000 rolagens', dmgInRange);
check('dano 2d6+2: mínimo observado = 4', minDmg === 4, `min=${minDmg}`);
check('dano 2d6+2: máximo observado = 14', maxDmg === 14, `max=${maxDmg}`);

const facesSeen = new Set<number>();
let locInRange = true;
for (let i = 0; i < 2000; i++) {
  const loc = rollLocation();
  facesSeen.add(loc.roll);
  if (loc.roll < 1 || loc.roll > 10 || loc.name.length === 0) locInRange = false;
}
check('local: 2000 rolagens na faixa 1..10', locInRange);
check('local: todas as 10 faces aparecem (distribuição)', facesSeen.size === 10, `faces=${facesSeen.size}`);

const skillFaces = new Set<number>();
let skillMin = Infinity;
let skillMax = -Infinity;
for (let i = 0; i < 2000; i++) {
  const r = rollSkill(0, 0); // só o dado
  skillFaces.add(r.baseRoll);
  skillMin = Math.min(skillMin, r.total);
  skillMax = Math.max(skillMax, r.total);
}
check('perícia: todas as 10 faces do d10 aparecem', skillFaces.size === 10, `faces=${skillFaces.size}`);
check('perícia: fumble reduz abaixo do mínimo normal (1-10)', skillMin < 0, `min=${skillMin}`);
check('perícia: explosão ultrapassa 10', skillMax > 10, `max=${skillMax}`);

// ---------------------------------------------------------------------------
// 10. Determinismo — mesma seed, mesma sequência
// ---------------------------------------------------------------------------
NumberGenerator.generator.engine = NumberGenerator.engines.MersenneTwister19937.seed(77);
const seqA = [new DiceRoll('1d10').total, new DiceRoll('1d10').total, new DiceRoll('1d10').total];
NumberGenerator.generator.engine = NumberGenerator.engines.MersenneTwister19937.seed(77);
const seqB = [new DiceRoll('1d10').total, new DiceRoll('1d10').total, new DiceRoll('1d10').total];
check('determinismo: mesma seed → mesma sequência', JSON.stringify(seqA) === JSON.stringify(seqB), JSON.stringify(seqA));

// Restaura o RNG padrão (não deixa estado global alterado)
NumberGenerator.generator.engine = NumberGenerator.engines.nativeMath;

// ---------------------------------------------------------------------------
console.log(`\n📊 Resultado: ${passed} passaram, ${failed} falharam`);
process.exit(failed === 0 ? 0 : 1);
