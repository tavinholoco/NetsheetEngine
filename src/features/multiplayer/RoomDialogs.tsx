import React from 'react';
import type { RoomPlayer } from '../../types/multiplayer';
import { CreationBudget } from './CreationBudget';
import { formatEb } from '../../lib/format';
import { woundRow } from '../../rules/character';
import { woundLevelColor } from '../../utils/injuryRules';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';

/*
 * L.3c (G.21) — os dois modais da mesa. No Dialog do Radix (F.4.2): foco preso
 * dentro, Esc fecha, role="dialog" com o título ligado. Eram feitos à mão. Abrem
 * por estado, e quem os abre devolve o foco no `onCloseAutoFocus`.
 */

interface HealthMonitorDialogProps {
  selectedHealthPlayer: RoomPlayer | null;
  onClose: () => void;
  onCloseAutoFocus: (e: Event) => void;
  onSetWound: (targetPeerId: string, woundLevel: number) => void;
}

/** Editar a saúde (GM): o nível de ferimento, de 0 a 10. */
export const HealthMonitorDialog: React.FC<HealthMonitorDialogProps> = ({
  selectedHealthPlayer,
  onClose,
  onCloseAutoFocus,
  onSetWound
}) => (
  <Dialog open={selectedHealthPlayer !== null} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="max-w-sm border-2 border-danger-500/60 rounded-2xl sm:rounded-2xl shadow-glow-30 shadow-danger-500/30 font-sans">
      {selectedHealthPlayer && (
        <>
          <DialogTitle className="text-sm font-black text-danger-400 pr-6">
            Bio-Monitor // {selectedHealthPlayer.handle}
          </DialogTitle>
          <DialogDescription className="sr-only">Escolha o nível de ferimento, de 0 a 10.</DialogDescription>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 11 }).map((_, i) => (
              <button
                key={i}
                onClick={() => onSetWound(selectedHealthPlayer.peerId, i)}
                className={`aspect-square rounded border-2 text-micro font-mono cursor-pointer transition-all ${
                  i <= selectedHealthPlayer.sheet.woundLevel
                    ? 'border-danger-500 bg-danger-950/80 text-danger-300'
                    : 'border-line bg-raised text-subtle hover:border-danger-500/50'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <DialogClose className="w-full py-2 bg-raised border border-line-strong text-fg-soft rounded text-micro uppercase cursor-pointer">
            Fechar
          </DialogClose>
        </>
      )}
    </DialogContent>
  </Dialog>
);

interface InspectSheetDialogProps {
  inspectedPlayer: RoomPlayer | null;
  isGm: boolean;
  onClose: () => void;
  onCloseAutoFocus: (e: Event) => void;
}

/** Inspecionar a ficha; o GM vê também o orçamento da criação (K.6). */
export const InspectSheetDialog: React.FC<InspectSheetDialogProps> = ({
  inspectedPlayer,
  isGm,
  onClose,
  onCloseAutoFocus
}) => (
  <Dialog open={inspectedPlayer !== null} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="max-w-md border-2 border-accent-500/60 rounded-2xl sm:rounded-2xl shadow-glow-30 shadow-accent-500/30 max-h-[80vh] overflow-y-auto custom-scrollbar font-sans">
      {inspectedPlayer && (
        <>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-sm font-black">{inspectedPlayer.handle}</DialogTitle>
            <span className="text-micro px-2 py-0.5 rounded bg-raised border border-line-strong text-signal-400">{inspectedPlayer.role}</span>
          </div>
          <DialogDescription className="sr-only">
            Ficha de {inspectedPlayer.handle}: atributos, ferimento, verba, armas e cyberware.
          </DialogDescription>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(inspectedPlayer.sheet.stats) as (keyof typeof inspectedPlayer.sheet.stats)[]).map((k) => (
              <div key={k} className="bg-raised border border-line rounded p-1.5 text-center">
                <span className="text-micro text-subtle block">{k}</span>
                <span className="font-mono text-xs text-signal-400">{inspectedPlayer.sheet.stats[k]}</span>
              </div>
            ))}
          </div>
          <div className="font-mono text-micro text-muted space-y-1">
            {/* Revisão da K — o nome da trilha do livro, como o cartão do token (K.3a):
                o "2/10" era o índice do nível. */}
            <p>💥 Ferimento: <span className={woundLevelColor(inspectedPlayer.sheet.woundLevel)}>{woundRow(inspectedPlayer.sheet.woundLevel).name}</span></p>
            <p>💰 {formatEb(inspectedPlayer.sheet.eurodollars)}</p>
            <p>🔫 Armas: {inspectedPlayer.sheet.weapons.map(w => w.name).join(', ') || 'nenhuma'}</p>
            <p>🦾 Ciberware: {inspectedPlayer.sheet.cyberware.length} itens</p>
          </div>
          {isGm && <CreationBudget sheet={inspectedPlayer.sheet} />}
          <DialogClose className="w-full py-2 bg-raised border border-line-strong text-fg-soft rounded text-micro uppercase cursor-pointer">
            Fechar
          </DialogClose>
        </>
      )}
    </DialogContent>
  </Dialog>
);
