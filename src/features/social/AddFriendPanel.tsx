/**
 * L.3d — o painel "adicionar por ID": a busca, as sugestões da rede e o
 * cartão do resultado.
 *
 * O bloco saiu inteiro do `FriendsList` (mapa da G.1f), com o estado da busca
 * junto — é estado só dele. O que continua no pai é a lista de amigos e o
 * `friendsReloadKey` dos NPCs, que a busca avisa por `onNpcFriendAdded`.
 */
import React, { useState } from 'react';
import { Check, Clock, Search, UserCheck, X } from 'lucide-react';
import {
  DEMO_CYBERPUNK_USERS,
  searchUserByCyberpunkId,
  sendFriendRequest,
  type FriendRequest,
  type FriendUser,
  type User
} from '../../lib/supabase';
import { FriendAvatar } from './friendVisuals';
import { profileFromUser } from './friendProfile';

export interface AddFriendPanelProps {
  user: User;
  friends: FriendUser[];
  pendingRequests: FriendRequest[];
  /** Fecha o painel (o X). */
  onClose: () => void;
  /** NPC vive em localStorage e não dispara Realtime — o pai re-subscreve. */
  onNpcFriendAdded: () => void;
}

export const AddFriendPanel: React.FC<AddFriendPanelProps> = ({
  user,
  friends,
  pendingRequests,
  onClose,
  onNpcFriendAdded
}) => {
  // Search state
  const [searchIdInput, setSearchIdInput] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<Omit<FriendUser, 'addedAt'> | null>(null);
  const [searchError, setSearchError] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<string>('');

  // Handle User Search by ID
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchIdInput.trim()) return;

    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    setActionFeedback('');

    try {
      const result = await searchUserByCyberpunkId(searchIdInput);
      if (result) {
        if (result.uid === user.uid) {
          setSearchError('Este é o seu próprio ID de Edgerunner.');
        } else {
          setSearchResult(result);
        }
      } else {
        setSearchError('Edgerunner não encontrado com este ID.');
      }
    } catch {
      setSearchError('Erro ao buscar ID na rede de Night City.');
    } finally {
      setSearching(false);
    }
  };

  // Já é amigo ou já tem pedido pendente — a mesma conta no envio e no cartão
  // do resultado (eram duas cópias da mesma checagem neste arquivo).
  const linksTo = (target: { uid: string; cyberpunkId: string }) => ({
    isAlreadyFriend: friends.some(
      (f) => f.uid === target.uid || f.cyberpunkId.toUpperCase() === target.cyberpunkId.toUpperCase()
    ),
    isPendingReq: pendingRequests.some(
      (r) => r.senderUid === target.uid || r.receiverUid === target.uid
    )
  });

  // Handle Sending Request with strict duplicate detection
  const handleSendRequest = async (target: Omit<FriendUser, 'addedAt'>) => {
    const { isAlreadyFriend, isPendingReq } = linksTo(target);
    if (isAlreadyFriend) {
      setActionFeedback(`Atenção: O Edgerunner ${target.displayName} (${target.cyberpunkId}) já está na sua lista de amigos!`);
      return;
    }

    if (isPendingReq) {
      setActionFeedback(`Aviso: Já existe uma solicitação de amizade pendente para ${target.displayName}.`);
      return;
    }

    setSearching(true);
    setActionFeedback('Processando na rede...');

    const senderProfile = profileFromUser(user);

    try {
      const res = await sendFriendRequest(senderProfile, target);
      setActionFeedback(res.message);
      if (res.success) {
        // NPCs não disparam Realtime (ficam em localStorage) → força refresh da lista
        if (target.uid.startsWith('npc_')) {
          onNpcFriendAdded();
        }
        setTimeout(() => {
          setSearchResult(null);
          setSearchIdInput('');
          setActionFeedback('');
        }, 3000);
      }
    } catch {
      setActionFeedback('Erro ao comunicar com a rede.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="mt-2.5 p-2 bg-raised/95 border border-accent-500/40 rounded-lg space-y-2 animate-fadeIn">
      <div className="flex items-center justify-between text-micro text-accent-400 font-bold uppercase tracking-caps">
        <span className="flex items-center space-x-1">
          <Search className="w-3 h-3" />
          <span>BUSCAR EDGERUNNER POR ID</span>
        </span>
        <button
          onClick={onClose}
          className="text-muted hover:text-accent-400 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex space-x-1">
        <input
          type="text"
          placeholder="Ex: #NC-1815 ou #NC-2020"
          value={searchIdInput}
          onChange={(e) => setSearchIdInput(e.target.value)}
          className="flex-1 bg-black/80 border border-field text-fg-strong px-2 py-1 rounded text-mini font-mono focus:border-accent-400 focus:outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-2.5 py-1 bg-accent-500 hover:bg-accent-400 text-black font-bold text-micro rounded uppercase cursor-pointer transition-all disabled:opacity-50"
        >
          {searching ? '...' : 'BUSCAR'}
        </button>
      </form>

      {/* Quick Demo Suggestions */}
      {!searchResult && !searchError && (
        <div className="pt-1 border-t border-line">
          <span className="text-micro text-subtle block mb-1 uppercase">
            Sugestões da Rede:
          </span>
          <div className="flex flex-wrap gap-1">
            {DEMO_CYBERPUNK_USERS.map((demo) => (
              <button
                key={demo.uid}
                onClick={() => {
                  setSearchIdInput(demo.cyberpunkId);
                  setSearchResult(demo);
                  setSearchError('');
                }}
                className="text-micro bg-surface hover:bg-raised-strong border border-line hover:border-accent-500/40 text-fg-soft px-1.5 py-0.5 rounded font-mono flex items-center space-x-1 cursor-pointer"
              >
                <span className="text-accent-400 font-bold">{demo.cyberpunkId}</span>
                <span className="text-muted">({demo.displayName})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Error */}
      {searchError && (
        <div className="text-micro text-fault-400 bg-fault-950/40 p-1.5 rounded border border-fault-500/30">
          {searchError}
        </div>
      )}

      {/* Search Result Box */}
      {searchResult && (() => {
        const { isAlreadyFriend, isPendingReq } = linksTo(searchResult);

        return (
          <div className="p-2 bg-surface border border-accent-500/50 rounded space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded bg-raised border border-accent-500/30 flex items-center justify-center shrink-0">
                  <FriendAvatar iconKey={searchResult.avatarIcon} />
                </div>
                <div>
                  <span className="text-xs font-bold text-fg-strong block leading-tight">
                    {searchResult.displayName}
                  </span>
                  <span className="text-micro font-mono text-accent-300">
                    {searchResult.cyberpunkId}
                  </span>
                </div>
              </div>

              {isAlreadyFriend ? (
                <span className="px-2 py-1 bg-signal-950/90 text-signal-400 border border-signal-500/60 font-bold text-micro rounded uppercase flex items-center space-x-1 shadow-glow-8 shadow-signal-500/20">
                  <Check className="w-3 h-3 text-signal-400" />
                  <span>JÁ É AMIGO</span>
                </span>
              ) : isPendingReq ? (
                <span className="px-2 py-1 bg-accent-950/90 text-accent-400 border border-accent-500/60 font-bold text-micro rounded uppercase flex items-center space-x-1 shadow-glow-8 shadow-accent-500/20">
                  <Clock className="w-3 h-3 text-accent-400" />
                  <span>PENDENTE</span>
                </span>
              ) : (
                <button
                  onClick={() => handleSendRequest(searchResult)}
                  disabled={searching}
                  className="px-2 py-1 bg-ok-500 hover:bg-ok-400 text-black font-black text-micro rounded uppercase flex items-center space-x-1 cursor-pointer transition-all shadow-glow-10 shadow-ok-500/30 disabled:opacity-50"
                >
                  <UserCheck className="w-3 h-3" />
                  <span>ADICIONAR</span>
                </button>
              )}
            </div>

            {isAlreadyFriend && (
              <div className="text-micro text-signal-400/90 bg-signal-950/30 p-1.5 rounded border border-signal-500/30">
                Aviso: Este Edgerunner ({searchResult.cyberpunkId}) já está na sua lista de amigos.
              </div>
            )}
          </div>
        );
      })()}

      {actionFeedback && (
        <div className="text-micro text-accent-300 text-center pt-0.5">
          {actionFeedback}
        </div>
      )}
    </div>
  );
};
