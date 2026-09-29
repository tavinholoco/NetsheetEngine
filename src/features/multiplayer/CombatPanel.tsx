import React, { useState } from 'react';
import type { ArmorLocation, RollResult } from '../../types/cyberpunk';
import type { RoomPlayer } from '../../types/multiplayer';
import { HIT_LOCATIONS, RANGE_BANDS, WOUND_TRACK_POINTS, type RangeBandKey } from '../../rules/tables';
import { rangeBandMeters } from '../../rules/combat';
import { Crosshair, Droplet } from 'lucide-react';

/**
 * Fase D (D.3) — combate sem sair do grid, no cartão do token selecionado.
 * Só o GM vê. Duas ações, as duas com a conta feita no servidor:
 * - o NPC ataca este alvo (ataque → acerto → dano → ferimento, uma mutação);
 * - aplicar um dano (o que um jogador rolou, ou digitado).
 * Escolher atacante, faixa e local é estado local: nada vai à rede até o
 * clique final (contrato de custo — ARQ-01).
 */
interface CombatPanelProps {
  targetId: string;
  targetName: string;
  /** NPCs com ficha que podem atacar (vivos, e não o próprio alvo). */
  attackers: RoomPlayer[];
  /** A rolagem de dano mais recente do chat que tem o local estruturado. */
  lastDamageRoll?: RollResult;
  onAttack: (input: { attackerId: string; targetId: string; range?: RangeBandKey; difficulty?: number }) => void;
  onApplyDamage: (targetId: string, raw: number, location: ArmorLocation) => void;
  /** D.5 — estado do alvo e o botão de estabilizar (só em Mortal). */
  status: { label: string; points: number; isMortal: boolean; isDead: boolean; isStabilized: boolean };
  onToggleStabilized: (targetId: string, stabilized: boolean) => void;
}

const FREE = 'free';

export const CombatPanel: React.FC<CombatPanelProps> = ({
  targetId,
  targetName,
  attackers,
  lastDamageRoll,
  onAttack,
  onApplyDamage,
  status,
  onToggleStabilized
}) => {
  const [attackerId, setAttackerId] = useState(attackers[0]?.peerId ?? '');
  const [range, setRange] = useState<RangeBandKey | typeof FREE>('medium');
  const [freeDifficulty, setFreeDifficulty] = useState(15);
  const [raw, setRaw] = useState(0);
  const [location, setLocation] = useState<ArmorLocation>('Torso');

  const attacker = attackers.find((a) => a.peerId === attackerId) ?? attackers[0];
  const weapon = attacker?.sheet.weapons?.find((w) => w.equipped) ?? attacker?.sheet.weapons?.[0];

  const attack = () => {
    if (!attacker) return;
    onAttack(
      range === FREE
        ? { attackerId: attacker.peerId, targetId, difficulty: freeDifficulty }
        : { attackerId: attacker.peerId, targetId, range }
    );
  };

  const useLastDamage = () => {
    if (!lastDamageRoll?.hitLocation) return;
    setRaw(lastDamageRoll.total);
    setLocation(lastDamageRoll.hitLocation);
  };

  const label = 'text-[10px] font-mono uppercase text-slate-400';
  const input = 'w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200 font-mono';

  return (
    <div className="space-y-2 border-t border-slate-800 pt-2">
      {/* Estado do alvo (D.1/D.5) */}
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
        <span className={status.isDead ? 'text-red-400 font-bold' : 'text-slate-300'}>
          {status.isDead ? '💀 MORTO' : status.label} · {status.points}/{WOUND_TRACK_POINTS}
          {status.isStabilized && !status.isDead && <span className="text-emerald-400"> · estabilizado</span>}
        </span>
        {status.isMortal && !status.isDead && (
          <button
            type="button"
            onClick={() => onToggleStabilized(targetId, !status.isStabilized)}
            title="Depois do teste de First Aid / Medical Tech: para o death save a cada turno. Dano novo desfaz."
            className="px-1.5 py-0.5 rounded border border-emerald-600 text-emerald-300 hover:bg-emerald-950 cursor-pointer shrink-0"
          >
            {status.isStabilized ? 'Desfazer' : '🩹 Estabilizar'}
          </button>
        )}
      </div>

      {/* O NPC ataca */}
      <details className="group bg-slate-900/90 rounded-lg border border-slate-800">
        <summary className="flex items-center gap-1 p-2 text-[11px] font-bold text-amber-300 uppercase cursor-pointer select-none">
          <Crosshair className="w-3.5 h-3.5" /> NPC ataca {targetName}
        </summary>
        <div className="space-y-1.5 px-2 pb-2">
        {attackers.length === 0 ? (
          <p className="text-[10px] text-slate-500">Nenhum NPC com ficha na mesa para atacar.</p>
        ) : (
          <>
            <label className="block">
              <span className={label}>Atacante</span>
              <select value={attacker?.peerId} onChange={(e) => setAttackerId(e.target.value)} className={input} aria-label="Atacante">
                {attackers.map((a) => (
                  <option key={a.peerId} value={a.peerId}>{a.handle}</option>
                ))}
              </select>
            </label>
            {weapon && <p className="text-[10px] text-slate-500 font-mono truncate">{weapon.name} · {weapon.damage} · {weapon.rangeMeters} m</p>}
            <div role="radiogroup" aria-label="Faixa de alcance" className="grid grid-cols-3 gap-1">
              {RANGE_BANDS.map((band) => (
                <button
                  key={band.key}
                  type="button"
                  role="radio"
                  aria-checked={range === band.key}
                  onClick={() => setRange(band.key)}
                  title={weapon ? `até ${rangeBandMeters(band, weapon.rangeMeters)} m com ${weapon.name}` : undefined}
                  className={`px-1 py-1 rounded border text-[10px] font-mono cursor-pointer ${range === band.key ? 'border-amber-400 text-amber-300 bg-amber-950/50' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                >
                  {band.name} {band.difficulty}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={range === FREE}
                onClick={() => setRange(FREE)}
                title="Dificuldade livre — no corpo a corpo, o total do defensor"
                className={`px-1 py-1 rounded border text-[10px] font-mono cursor-pointer ${range === FREE ? 'border-amber-400 text-amber-300 bg-amber-950/50' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
              >
                Outra
              </button>
            </div>
            {range === FREE && (
              <label className="block">
                <span className={label}>Dificuldade (1–50)</span>
                <input type="number" min={1} max={50} value={freeDifficulty} onChange={(e) => setFreeDifficulty(Number(e.target.value))} className={input} />
              </label>
            )}
            <button
              type="button"
              onClick={attack}
              className="w-full py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] uppercase cursor-pointer"
            >
              Rolar ataque
            </button>
          </>
        )}
        </div>
      </details>

      {/* Aplicar dano */}
      <details className="group bg-slate-900/90 rounded-lg border border-slate-800">
        <summary className="flex items-center gap-1 p-2 text-[11px] font-bold text-red-300 uppercase cursor-pointer select-none">
          <Droplet className="w-3.5 h-3.5" /> Aplicar dano em {targetName}
        </summary>
        <div className="space-y-1.5 px-2 pb-2">
        {lastDamageRoll?.hitLocation && (
          <button
            type="button"
            onClick={useLastDamage}
            className="w-full py-1 rounded border border-slate-700 hover:border-slate-500 text-[10px] text-slate-300 font-mono cursor-pointer truncate"
          >
            Usar último dano: {lastDamageRoll.total} ({lastDamageRoll.characterName})
          </button>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block">
            <span className={label}>Dano bruto</span>
            <input type="number" min={0} value={raw} onChange={(e) => setRaw(Number(e.target.value))} className={input} />
          </label>
          <label className="block">
            <span className={label}>Local</span>
            <select value={location} onChange={(e) => setLocation(e.target.value as ArmorLocation)} className={input} aria-label="Local de impacto">
              {HIT_LOCATIONS.map((row) => (
                <option key={row.location} value={row.location}>{row.name}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => onApplyDamage(targetId, raw, location)}
          disabled={!(raw > 0)}
          className="w-full py-1.5 rounded bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-[11px] uppercase cursor-pointer"
        >
          Aplicar {raw > 0 ? raw : ''} de dano
        </button>
        </div>
      </details>
    </div>
  );
};
