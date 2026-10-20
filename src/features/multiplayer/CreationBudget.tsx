import React from 'react';
import type { CharacterSheet } from '../../types/cyberpunk';
import { creationReport } from '../../rules/creation';

/**
 * K.6c — O ORÇAMENTO DA CRIAÇÃO, À VISTA DO GM
 * O servidor não barra a ficha acima do orçamento — o IP e o cromo sobem os
 * números depois da criação, e ele não tem o histórico (K.0). O GM vê o que a
 * criação gastou contra o orçamento e contra a ficha de hoje, e decide. As contas
 * saem de `creationReport` (src/rules/creation.ts).
 */
export const CreationBudget: React.FC<{ sheet: CharacterSheet }> = ({ sheet }) => {
  const report = creationReport(sheet);
  return (
    <section aria-label="Orçamento de criação" className="bg-raised border border-line rounded p-2.5 space-y-1.5">
      <span className="text-micro font-black text-signal-400 uppercase tracking-caps block">Orçamento de criação</span>
      {report.recorded && (
        <p className="text-micro text-muted">
          {report.method === 'roll9d10' ? (
            <>9D10 · bolo <span className="font-mono text-fg-strong">{report.pool}</span> ({report.dice.join(' ')})</>
          ) : (
            <>Bolo do Mestre · <span className="font-mono text-fg-strong">{report.pool}</span></>
          )}
          {report.funds !== null && (
            <> · verba <span className="font-mono text-fg-strong">{report.funds.toLocaleString('pt-BR')} eb</span></>
          )}
        </p>
      )}
      <ul className="text-micro text-muted space-y-0.5">
        {report.lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-2">
            <span>{l.label} <span className="text-subtle">(criação/orçamento → hoje)</span></span>
            <span data-testid={`report-${l.key}`} className="font-mono text-fg-strong">
              {l.atCreation ?? '—'}/{l.budget ?? '—'} → {l.now}
            </span>
          </li>
        ))}
      </ul>
      {[...report.notes, ...report.warnings].length > 0 && (
        <ul className="text-micro space-y-0.5 list-disc pl-4">
          {report.notes.map((n) => (
            <li key={n} className="text-subtle">{n}</li>
          ))}
          {report.warnings.map((w) => (
            <li key={w} className="text-caution-300">{w}</li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** A marca da lista de jogadores: só quando algo passou do orçamento ou não bate. */
export const CreationBudgetMark: React.FC<{ handle: string; sheet: CharacterSheet }> = ({ handle, sheet }) => {
  const { warnings } = creationReport(sheet);
  if (warnings.length === 0) return null;
  return (
    <span
      role="img"
      aria-label={`${handle} fora do orçamento de criação`}
      title={warnings.join('\n')}
      className="text-micro px-1 py-0.5 rounded bg-caution-950/80 border border-caution-700/60 text-caution-300 shrink-0"
    >
      orç.
    </span>
  );
};
