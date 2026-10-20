import React, { useEffect, useState } from 'react';
import { NumberField } from '../sheet/CharacterSheet/NumberField';
import { useInFlight } from '../../hooks/useInFlight';

/**
 * K.3b (o I.01) — as condições da cena, escritas pelo GM. A rota `/settings`
 * existe desde a C.4, e a rolagem já soma o modificador e mostra o motivo no
 * detalhe ("Mod. do Mestre: escuridão (−2)"); faltava quem os escrevesse. O
 * rascunho é local até o clique, e volta ao que a mesa tem quando ela muda.
 */
export interface SceneSettings {
  locationName: string;
  combatModifier: number;
  modifierReason: string;
}

interface SceneConditionsProps extends SceneSettings {
  /** G.06 — devolve a requisição: o botão fica desligado até ela voltar. */
  onApply: (settings: SceneSettings) => Promise<unknown>;
}

/** O teto da rota (C.4): o servidor grampeia no mesmo intervalo. */
const MOD_MIN = -10;
const MOD_MAX = 10;

/** "−2", "+1": o sinal sempre à vista, com o menos tipográfico do detalhe da rolagem. */
export const signedModifier = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export const SceneConditions: React.FC<SceneConditionsProps> = ({ locationName, combatModifier, modifierReason, onApply }) => {
  const [location, setLocation] = useState(locationName);
  const [modifier, setModifier] = useState(combatModifier);
  const [reason, setReason] = useState(modifierReason);
  const { run, isBusy } = useInFlight();

  // A mesa mudou (o próprio clique voltou, ou outra aba do GM): o rascunho segue.
  useEffect(() => setLocation(locationName), [locationName]);
  useEffect(() => setModifier(combatModifier), [combatModifier]);
  useEffect(() => setReason(modifierReason), [modifierReason]);

  const apply = () =>
    run('settings', () => onApply({ locationName: location, combatModifier: modifier, modifierReason: reason }));

  const label = 'text-micro uppercase text-muted';
  const field = 'w-full bg-surface border border-field rounded px-1.5 py-1 text-mini text-fg';
  const busy = isBusy('settings');

  return (
    <div className="bg-surface/80 border border-signal-500/40 rounded-xl p-3 space-y-2">
      <span className="text-micro font-black text-signal-400 uppercase tracking-caps block">Condições da cena</span>
      <label className="block">
        <span className={label}>Local</span>
        <input
          type="text"
          value={location}
          maxLength={60}
          onChange={(e) => setLocation(e.target.value)}
          aria-label="Local da cena"
          className={field}
        />
      </label>
      <div className="grid grid-cols-[4.5rem_1fr] gap-1.5">
        <label className="block">
          <span className={label}>Mod.</span>
          <NumberField
            value={modifier}
            min={MOD_MIN}
            max={MOD_MAX}
            label="Modificador do Mestre"
            onCommit={setModifier}
            className={`${field} font-mono`}
          />
        </label>
        <label className="block">
          <span className={label}>Motivo</span>
          <input
            type="text"
            value={reason}
            maxLength={120}
            placeholder="escuridão, fumaça, mira laser…"
            onChange={(e) => setReason(e.target.value)}
            aria-label="Motivo do modificador"
            className={`${field} placeholder:text-faint`}
          />
        </label>
      </div>
      <p className="text-micro text-subtle">
        De −10 a +10, em todo ataque e perícia da mesa — o do NPC também. Não entra no dano nem nos saves.
      </p>
      <button
        type="button"
        onClick={apply}
        disabled={busy}
        className="w-full px-2 py-1.5 bg-signal-500 hover:bg-signal-400 disabled:opacity-40 disabled:cursor-wait text-black font-black text-micro uppercase rounded cursor-pointer transition-all"
      >
        {busy ? 'Aplicando…' : 'Aplicar condições'}
      </button>
    </div>
  );
};
