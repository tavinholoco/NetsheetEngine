import type { TacticalGridState, TacticalToken } from '../../types/multiplayer';

/*
 * L.3c (G.21) — a conta do arrasto no grid tático, fora da tela: qual setor está
 * sob o ponteiro e como fica o grid depois de soltar. Puro: o TacticalGrid lê o
 * evento e escreve o resultado.
 */

/** Um setor: a coluna `x` e a linha `y`, a partir de 0. */
export interface Sector {
  x: number;
  y: number;
}

/** O retângulo do canvas na tela, o que o `getBoundingClientRect` devolve. */
export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** O setor sob o ponteiro, preso dentro do grid; `null` com o canvas sem tamanho. */
export function sectorFromPoint(rect: CanvasRect, clientX: number, clientY: number, cols: number, rows: number): Sector | null {
  if (rect.width === 0 || rect.height === 0) return null;

  const relX = Math.min(Math.max(0, clientX - rect.left), rect.width - 1);
  const relY = Math.min(Math.max(0, clientY - rect.top), rect.height - 1);

  const x = Math.floor((relX / rect.width) * cols);
  const y = Math.floor((relY / rect.height) * rows);

  return {
    x: Math.min(cols - 1, Math.max(0, x)),
    y: Math.min(rows - 1, Math.max(0, y))
  };
}

/**
 * O grid depois de soltar no `sector` o que o arrasto carrega (`dataStr`, o JSON
 * do `dataTransfer`). O GM move qualquer token e põe a ficha da barra lateral no
 * grid; o jogador move o PRÓPRIO token (o servidor T5.3 valida o dono). `null`
 * quando o drop não muda nada.
 */
export function gridAfterDrop(
  gridState: TacticalGridState,
  dataStr: string,
  sector: Sector,
  roleMode: 'gm' | 'player',
  peerId: string
): TacticalGridState | null {
  if (!dataStr) return null;
  let data;
  try {
    data = JSON.parse(dataStr);
  } catch {
    // Um arrasto que não veio deste grid (outro app, um arquivo) não vira token.
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  if (data.type === 'token_drag') {
    // Dragging an existing token already placed on the tactical grid
    const { tokenId } = data;
    const draggedToken = gridState.tokens.find(t => t.id === tokenId);
    // Jogador só move o próprio token; GM move qualquer um.
    if (!draggedToken) return null;
    if (roleMode !== 'gm' && draggedToken.peerId !== peerId) return null;
    const updatedTokens = gridState.tokens.map(t => {
      if (t.id === tokenId) {
        return { ...t, x: sector.x, y: sector.y };
      }
      return t;
    });

    return {
      ...gridState,
      tokens: updatedTokens
    };
  } else if (data.type === 'character_drag') {
    // Arrastar ficha da barra lateral (criar token) é poder exclusivo do GM
    if (roleMode !== 'gm') return null;
    // Dragging a character sheet or NPC card from the sidebar
    const { peerId: charPeerId, handle, role, isNpc, hp } = data;

    const existingTokenIndex = gridState.tokens.findIndex(
      t => t.peerId === charPeerId || t.id === `token_${charPeerId}` || t.id === `npc_token_${charPeerId}`
    );

    const updatedTokens = [...gridState.tokens];

    if (existingTokenIndex >= 0) {
      updatedTokens[existingTokenIndex] = {
        ...updatedTokens[existingTokenIndex],
        x: sector.x,
        y: sector.y
      };
    } else {
      const newTokenId = isNpc ? `npc_token_${charPeerId}` : `token_${charPeerId}`;
      const newToken: TacticalToken = {
        id: newTokenId,
        name: handle,
        type: isNpc ? 'npc' : 'player',
        x: sector.x,
        y: sector.y,
        peerId: charPeerId,
        role: role || 'Solo',
        hp: hp || 0,
        color: isNpc ? '#ef4444' : '#06b6d4'
      };
      updatedTokens.push(newToken);
    }

    return {
      ...gridState,
      tokens: updatedTokens
    };
  }
  return null;
}
