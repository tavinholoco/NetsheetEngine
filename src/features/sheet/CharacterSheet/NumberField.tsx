import React, { useState } from 'react';

/**
 * Campo numérico com rascunho — a lição da G.12 (o `StatInput` do StatBlock):
 * grampeado a cada tecla, o campo come o que se digita ("2." vira 2 e perde a
 * fração; com mínimo 1, apagar e digitar "2" dava "12"). Aqui o texto é livre
 * enquanto se digita, o número entra na ficha assim que cabe na faixa, e o
 * grampo só roda ao sair do campo. Aceita vírgula decimal.
 */
interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  /** Casas decimais aceitas (0 = inteiro). */
  decimals?: number;
  label: string;
  className?: string;
  onCommit: (next: number) => void;
}

export const NumberField: React.FC<NumberFieldProps> = ({ value, min, max, decimals = 0, label, className, onCommit }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const factor = 10 ** decimals;

  const parse = (text: string): number | null => {
    const n = Number(text.replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(n)) return null;
    return Math.round(n * factor) / factor;
  };

  const type = (text: string) => {
    setDraft(text);
    const n = parse(text);
    if (n !== null && n >= min && n <= max && n !== value) onCommit(n);
  };

  const leave = () => {
    if (draft === null) return;
    const n = parse(draft);
    if (n !== null) {
      const next = Math.min(max, Math.max(min, n));
      if (next !== value) onCommit(next);
    }
    setDraft(null);
  };

  return (
    <input
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      value={draft ?? String(value)}
      onChange={(e) => type(e.target.value)}
      onBlur={leave}
      onKeyDown={(e) => e.key === 'Enter' && leave()}
      aria-label={label}
      className={className}
    />
  );
};
