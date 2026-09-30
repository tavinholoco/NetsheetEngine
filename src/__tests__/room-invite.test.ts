/**
 * Revisão pós-D (R.11) — o código de convite que o cliente monta ao criar a
 * mesa: o prefixo que o GM digita + um sufixo aleatório de Web Crypto. Sem a
 * lista do lobby, o código é o convite — e ninguém pode adivinhá-lo.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { INVITE_ALPHABET, INVITE_SUFFIX_LENGTH, inviteCode, inviteSuffix } from '../lib/roomCode';
import { createRoom } from '../api/rooms';
import { useRoomStore } from '../stores/useRoomStore';
import { scriptedRng } from '../test/scriptedRng';

describe('inviteSuffix e inviteCode', () => {
  it('o alfabeto não tem símbolo ambíguo — o código é ditado em voz alta na mesa', () => {
    for (const c of ['0', 'O', '1', 'I', 'L']) expect(INVITE_ALPHABET).not.toContain(c);
    expect(new Set(INVITE_ALPHABET).size).toBe(INVITE_ALPHABET.length);
  });

  it('o sufixo tem o tamanho certo, só do alfabeto, e vem do RNG (Web Crypto por padrão)', () => {
    const s = inviteSuffix();
    expect(s).toHaveLength(INVITE_SUFFIX_LENGTH);
    expect([...s].every((c) => INVITE_ALPHABET.includes(c))).toBe(true);
    // Com um RNG roteirizado, o sufixo é exatamente as faces pedidas:
    expect(inviteSuffix(scriptedRng([1, 2, 3, 4, 5, 6]))).toBe(INVITE_ALPHABET.slice(0, 6));
  });

  it('~30 bits: dois códigos seguidos não se repetem', () => {
    const vistos = new Set(Array.from({ length: 200 }, () => inviteSuffix()));
    expect(vistos.size).toBe(200);
    expect(Math.log2(INVITE_ALPHABET.length) * INVITE_SUFFIX_LENGTH).toBeGreaterThan(29);
  });

  it('prefixo do GM + sufixo; o prefixo é normalizado e limitado a 12', () => {
    const rng = scriptedRng([1, 1, 1, 1, 1, 1]);
    expect(inviteCode(' nc-2020 ', rng)).toBe('NC-2020-222222');
    expect(inviteCode('mesa de sexta!', scriptedRng([1, 1, 1, 1, 1, 1]))).toBe('MESADESEXTA-222222');
    expect(inviteCode('ABCDEFGHIJKLMNOP', scriptedRng([1, 1, 1, 1, 1, 1]))).toBe('ABCDEFGHIJKL-222222');
    expect(inviteCode('', scriptedRng([1, 1, 1, 1, 1, 1]))).toBe('MESA-222222');
    expect(inviteCode('NC--', scriptedRng([1, 1, 1, 1, 1, 1]))).toBe('NC-222222');
  });
});

describe('createRoom — o cliente cria com o código de convite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useRoomStore.getState().resetRoom();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('manda o prefixo com sufixo e guarda o código que o servidor devolveu', async () => {
    let enviado = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        enviado = JSON.parse(String(init.body)).code;
        return new Response(JSON.stringify({ room: { code: enviado }, sessionToken: 't' }), { status: 200 });
      })
    );
    await createRoom({ code: 'NC-2020', name: 'Mesa', gmHandle: 'Dono' });
    expect(enviado).toMatch(new RegExp(`^NC-2020-[${INVITE_ALPHABET}]{${INVITE_SUFFIX_LENGTH}}$`));
    expect(useRoomStore.getState().roomCode).toBe(enviado);
  });
});
