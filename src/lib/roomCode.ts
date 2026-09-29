/**
 * Revisão pós-D (R.11) — O CÓDIGO DA SALA É O CONVITE
 * ====================================================
 * A sala saiu do lobby: entra-se pelo código ou pelo link `/room/CÓDIGO` que o
 * GM manda. Com isso o código precisa ser impossível de adivinhar — `NC-2020`,
 * que o GM digitava, era o primeiro chute de qualquer um.
 *
 * O GM segue escolhendo um prefixo legível, e o cliente acrescenta um sufixo
 * aleatório de Web Crypto: `NC-2020-K7Q9XD`. Seis símbolos de 31 dão ~30 bits
 * (~890 milhões de combinações); com o limitador do `join` (120/min por IP),
 * chutar uma sala leva anos.
 *
 * Por que no cliente, e não no servidor: o contrato da API não muda, e quem
 * cria uma sala por fora da interface, com código fraco, só expõe a PRÓPRIA
 * mesa — ninguém ganha acesso à sala de outra pessoa.
 */
import type { Rng } from '../rules/dice';
import { clientRng } from '../utils/diceEngine';

/** Sem 0/O e 1/I/L: o código é ditado em voz alta na mesa. */
export const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const INVITE_SUFFIX_LENGTH = 6;
/** O mesmo teto de prefixo que o código da sala tinha antes da R.11. */
const MAX_PREFIX = 12;

/** Sufixo aleatório, sem viés (o `clientRng` rejeita o excedente do Web Crypto). */
export function inviteSuffix(rng: Rng = clientRng): string {
  let out = '';
  for (let i = 0; i < INVITE_SUFFIX_LENGTH; i++) out += INVITE_ALPHABET[rng(INVITE_ALPHABET.length) - 1];
  return out;
}

/**
 * `PREFIXO-SUFIXO`. O prefixo é o que o GM digitou, em maiúsculas, só com
 * letras, dígitos e hífen, até 12 caracteres; vazio vira `MESA`. O total cabe
 * nos 24 que o servidor aceita (`isValidRoomCode`).
 */
export function inviteCode(prefix: string, rng: Rng = clientRng): string {
  const clean = prefix
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, MAX_PREFIX)
    .replace(/-+$/, '');
  return `${clean || 'MESA'}-${inviteSuffix(rng)}`;
}
