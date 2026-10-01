import React from 'react';
import { CharacterSheet } from '../../../types/cyberpunk';
import { WOUND_LEVEL_NAMES, isLastWoundBox } from '../../../utils/injuryRules';
import { deathSaveTarget, deriveCurrentStats, mortalLevel, stunSaveTarget, woundEffectText } from '../../../rules/character';
import { woundStateFromPoints, woundStateOf } from '../../../rules/damage';
import { DAMAGE_POINTS_PER_WOUND_LEVEL, WOUND_TRACK, WOUND_TRACK_POINTS } from '../../../rules/tables';
import { useRoomStore } from '../../../stores/useRoomStore';
import { HeartPulse, Skull, Activity, Zap, Lock } from 'lucide-react';

interface HealthTrackerProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
  onRollDeathSave: () => void;
  onRollStunSave: () => void;
}

/** Rótulo curto de cada nível, como na ficha impressa. */
const SHORT_NAME: Record<number, string> = { 1: 'Leve', 2: 'Sério', 3: 'Crítico' };
const shortName = (level: number) => SHORT_NAME[level] ?? `M${level - 4}`;

export const HealthTracker: React.FC<HealthTrackerProps> = ({ sheet, onChange, onRollDeathSave, onRollStunSave }) => {
  // D.1 — a trilha conta PONTOS (4 caixas por nível, 40 no total), como o
  // livro. O nível é derivado; ficha antiga sem pontos converte sozinha.
  const wound = woundStateOf(sheet);
  const { damagePoints, woundLevel, isDead } = wound;
  // Decisão 7a — na mesa, o ferimento é do servidor e do GM. A ficha mostra,
  // mas não edita: o servidor descartaria a mudança de qualquer jeito.
  const atTable = useRoomStore((s) => s.view === 'active');

  const current = WOUND_LEVEL_NAMES[woundLevel] || WOUND_LEVEL_NAMES[0];
  const lastBox = isLastWoundBox(woundLevel);
  // C.7 — os alvos dos dois saves do livro, com o BODY corrente.
  const body = deriveCurrentStats(sheet).BODY;
  const mortal = mortalLevel(woundLevel);
  const stunTarget = stunSaveTarget(body, woundLevel);
  const deathTarget = deathSaveTarget(body, woundLevel);

  const setPoints = (points: number) => {
    if (atTable) return;
    onChange(woundStateFromPoints(points, isDead));
  };
  // Clicar a última caixa marcada desmarca ela; qualquer outra marca até ali.
  const clickBox = (point: number) => setPoints(point === damagePoints ? point - 1 : point);

  return (
    <div className="bg-raised/70 border-l-4 border-l-danger-500 border-y border-r border-line rounded-lg p-5 shadow-glow-20 shadow-danger-500/10 space-y-4 relative overflow-hidden">
      <div aria-hidden="true" className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-display text-[50px] font-black text-danger-500 select-none">
        BIOMON
      </div>

      <div className="flex items-center justify-between border-b border-line pb-3 relative z-10">
        <div className="flex items-center space-x-2">
          <HeartPulse className="w-5 h-5 text-danger-400" />
          <h2 className="text-base sm:text-lg font-display font-bold text-danger-400 uppercase tracking-display">
            Bio-Monitor // Ferimentos
          </h2>
        </div>
        <span className={`text-xs font-mono px-2.5 py-1 rounded border ${isDead || lastBox ? 'bg-danger-950 border-danger-500 text-danger-300 animate-pulse' : 'bg-surface border-line-strong text-fg'}`}>
          {/* F.3.1: o glitch é de evento — a key remonta o texto a cada nível, e ele
              só pisca uma vez ao entrar (ou piorar) em Mortal e ao morrer. */}
          <span key={isDead ? 'morto' : woundLevel} className={isDead || mortal !== null ? 'inline-block animate-glitch' : undefined}>
            {isDead ? 'MORTO' : current.name}
          </span>
        </span>
      </div>

      {/* Trilha do livro: 10 níveis × 4 caixas de 1 ponto */}
      <div className="relative z-10 space-y-2">
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-x-1.5 gap-y-2">
          {WOUND_TRACK.slice(1).map((row) => (
            <div key={row.level} className="flex flex-col items-center gap-1">
              <span className="text-micro uppercase text-subtle">{shortName(row.level)}</span>
              <div className="grid grid-cols-4 gap-0.5 w-full">
                {Array.from({ length: DAMAGE_POINTS_PER_WOUND_LEVEL }, (_, i) => {
                  const point = (row.level - 1) * DAMAGE_POINTS_PER_WOUND_LEVEL + i + 1;
                  const filled = point <= damagePoints;
                  return (
                    <button
                      key={point}
                      type="button"
                      onClick={() => clickBox(point)}
                      disabled={atTable}
                      aria-label={`Ponto ${point} (${row.name})`}
                      title={`${point} ponto(s) — ${row.name}`}
                      className={`aspect-square rounded-sm border transition-colors disabled:cursor-not-allowed ${
                        filled
                          ? 'border-danger-500 bg-danger-600/80'
                          : 'border-line-strong bg-surface/80 enabled:hover:border-night-500'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-mini text-muted">
          <span>
            <span className="font-mono text-fg">{damagePoints}</span>/{WOUND_TRACK_POINTS} pontos
          </span>
          {atTable ? (
            <span className="flex items-center gap-1 text-subtle">
              <Lock className="w-3 h-3" /> Na mesa, o Mestre aplica o dano
            </span>
          ) : (
            <span className="flex gap-2">
              <button type="button" onClick={() => setPoints(0)} className="px-2 py-0.5 rounded border border-line-strong hover:border-night-500 text-fg-soft cursor-pointer">
                Ileso
              </button>
              <button
                type="button"
                onClick={() => onChange({ isDead: !isDead })}
                aria-pressed={isDead}
                className={`px-2 py-0.5 rounded border cursor-pointer ${isDead ? 'border-danger-500 text-danger-300' : 'border-line-strong hover:border-night-500 text-fg-soft'}`}
              >
                {isDead ? 'Desmarcar morte' : 'Marcar morte'}
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Resumo e penalidades */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
        <div className="bg-surface/80 p-3 rounded-lg border border-line">
          <div className="flex items-center space-x-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-signal-400" />
            <span className="text-micro text-muted uppercase">Estado</span>
          </div>
          <span className={`font-mono text-sm ${isDead ? 'text-danger-400' : current.color}`}>{isDead ? 'Morto' : current.name}</span>
          {sheet.isStabilized && !isDead && mortal !== null && (
            <span className="block text-micro text-ok-400 mt-0.5">Estabilizado — sem death save por turno</span>
          )}
        </div>

        <div className="bg-surface/80 p-3 rounded-lg border border-line">
          <div className="flex items-center space-x-1.5 mb-1">
            <Skull className="w-3.5 h-3.5 text-danger-400" />
            <span className="text-micro text-muted uppercase">Efeito nos atributos</span>
          </div>
          <span className="font-mono text-sm text-danger-300">
            {woundEffectText(woundLevel)}
          </span>
        </div>

        <div className="bg-surface/80 p-3 rounded-lg border border-danger-500/40 flex flex-col justify-between">
          <div className="flex items-center space-x-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-signal-400" />
            <span className="text-micro text-muted uppercase">Saves</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={onRollStunSave}
              disabled={isDead}
              title="A cada dano sofrido: falhou, está fora de ação"
              className="px-3 py-1.5 bg-caution-500 hover:bg-caution-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-mini uppercase rounded transition-all cursor-pointer"
            >
              Stun · 1d10 ≤ {stunTarget}
            </button>
            <button
              onClick={onRollDeathSave}
              disabled={mortal === null || isDead}
              title={mortal === null ? 'O death save só é exigido em ferimento Mortal' : `Mortal ${mortal}: a cada turno, até ser estabilizado`}
              className="px-3 py-1.5 bg-signal-500 hover:bg-signal-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-mini uppercase rounded transition-all shadow-glow-12 shadow-signal-400/40 cursor-pointer"
            >
              Death · 1d10 ≤ {deathTarget}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
