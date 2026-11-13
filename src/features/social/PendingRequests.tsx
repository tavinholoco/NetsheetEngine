/**
 * L.3d — a lista de pedidos de amizade pendentes.
 *
 * O bloco saiu inteiro do `FriendsList`; quem aceita e recusa continua sendo o
 * pai (é lá que a chamada ao Supabase e os erros de antes vivem).
 */
import React from 'react';
import { Check, X } from 'lucide-react';
import type { FriendRequest } from '../../lib/supabase';
import { FriendAvatar } from './friendVisuals';

export interface PendingRequestsProps {
  requests: FriendRequest[];
  onAccept: (req: FriendRequest) => void;
  onReject: (requestId: string) => void;
}

export const PendingRequests: React.FC<PendingRequestsProps> = ({ requests, onAccept, onReject }) => (
  <div className="mt-2 space-y-1 bg-signal-950/30 border border-signal-500/40 p-2 rounded-lg">
    <span className="text-micro font-black text-signal-400 uppercase tracking-caps block">
      PENDENTES ({requests.length})
    </span>
    <div className="space-y-1.5">
      {requests.map((req) => (
        <div
          key={req.id}
          className="flex items-center justify-between bg-surface/90 p-1.5 rounded border border-signal-500/30"
        >
          <div className="flex items-center space-x-1.5 min-w-0">
            <div className="w-6 h-6 rounded bg-raised border border-signal-500/30 flex items-center justify-center shrink-0">
              <FriendAvatar iconKey={req.senderAvatar} />
            </div>
            <div className="min-w-0">
              <span className="text-mini font-bold text-fg-strong block truncate">
                {req.senderName}
              </span>
              <span className="text-micro font-mono text-accent-400 block">
                {req.senderCyberpunkId}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => onAccept(req)}
              title="Aceitar"
              className="p-1 bg-ok-500/20 hover:bg-ok-500/40 text-ok-400 border border-ok-500/50 rounded transition-all cursor-pointer"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => onReject(req.id)}
              title="Recusar"
              className="p-1 bg-fault-500/20 hover:bg-fault-500/40 text-fault-400 border border-fault-500/50 rounded transition-all cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);
