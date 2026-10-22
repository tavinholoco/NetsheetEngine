// L.3b — a chave de uma sala, sem dependência: as sessões, as salas, a persistência e quem escuta cada sala
// importam daqui.
/**
 * L.3b — o E.11: a chave de uma sala. Era `code.toUpperCase()` em 25 pontos, uns com `trim()` e outros
 * sem, e um stream aberto com espaço no código achava a sala e caía num conjunto que o reenvio nunca
 * visitava. Toda leitura e toda escrita de mapa por código de sala passam por aqui.
 */
export function roomKey(code: string): string {
  return code.trim().toUpperCase();
}
