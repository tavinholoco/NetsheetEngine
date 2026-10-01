import { ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * O tailwind-merge não lê o @theme (src/index.css): um nome que ele não
 * conhece cai no grupo "cor" e briga com a cor de verdade — e um dos dois some.
 * Na Fase F, `shadow-glow-30` sumia ao lado de `shadow-accent-500/30` (o modal
 * de login ficou sem brilho) e `text-micro` ao lado de `text-muted`. Os tokens
 * de TAMANHO do @theme moram aqui também; os de cor ele já trata como cor.
 * O cn-theme.test deriva a lista do @theme e falha se um token novo faltar.
 */
const brilho = (valor: string) => /^glow-\d+$/.test(valor);

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['micro', 'mini'],
      tracking: ['caps', 'display'],
      shadow: [brilho],
      'drop-shadow': [brilho],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
