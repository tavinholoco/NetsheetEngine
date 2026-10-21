/**
 * L.5 — o `errorMessage`, que tomou o lugar do `catch (e: any) { e?.message || … }`.
 * Ele tem de dar a mesma mensagem que o `e?.message || fallback` dava nos casos
 * que a tela recebe: o erro da API, o do Supabase e o do navegador.
 */
import { describe, it, expect } from 'vitest';
import { errorMessage } from '../lib/errorMessage';
import { ApiError } from '../api/http';

describe('L.5 — errorMessage', () => {
  it('a mensagem do erro da API, do navegador e do objeto do Supabase', () => {
    expect(errorMessage(new ApiError(409, 'Já existe uma mesa com o código NC-2020.', 'room_exists'), 'x')).toBe(
      'Já existe uma mesa com o código NC-2020.'
    );
    expect(errorMessage(new TypeError('Failed to fetch'), 'x')).toBe('Failed to fetch');
    expect(errorMessage({ message: 'Invalid login credentials', status: 400 }, 'x')).toBe('Invalid login credentials');
  });

  it('o texto da tela quando o erro não traz mensagem', () => {
    for (const e of [undefined, null, 'texto solto', 42, {}, { message: '' }, { message: 7 }, new Error('')]) {
      expect(errorMessage(e, 'Erro ao criar sala.')).toBe('Erro ao criar sala.');
    }
  });
});
