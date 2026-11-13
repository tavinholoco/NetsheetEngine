/**
 * ============================================================
 * NETSHEET ENGINE — REDE DE AMIGOS (T2.12)
 *
 * L.3d — o arquivo passou de 721 linhas para a lista e o que ela mesma faz.
 * Saíram, pelo mapa da G.1f: o `FriendChatBox` (arquivo próprio), o painel de
 * busca com o estado dele (`AddFriendPanel`), a lista de pedidos pendentes
 * (`PendingRequests`), o ícone e o LED do amigo (`friendVisuals`) e o perfil
 * que o pedido grava (`friendProfile`). Nada mudou de comportamento.
 * ============================================================
 */
import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  UserX
} from 'lucide-react';
import {
  User,
  FriendUser,
  FriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  subscribeToFriends,
  subscribeToPendingRequests
} from '../../lib/supabase';
import { FriendChatBox } from './FriendChatBox';
import { AddFriendPanel } from './AddFriendPanel';
import { PendingRequests } from './PendingRequests';
import { FriendAvatar, FriendStatus } from './friendVisuals';
import { profileFromUser } from './friendProfile';

interface FriendsListProps {
  user: User | null;
  isMinimized?: boolean;
}

export const FriendsList: React.FC<FriendsListProps> = ({ user, isMinimized = false }) => {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Interactive friend menu & chat state
  const [selectedFriendUid, setSelectedFriendUid] = useState<string | null>(null);
  const [activeChatFriendUid, setActiveChatFriendUid] = useState<string | null>(null);

  // Reload token: NPCs são salvos em localStorage (não em profiles), então
  // adicionar/remover NPC não dispara Realtime — forçamos re-subscrição.
  const [friendsReloadKey, setFriendsReloadKey] = useState<number>(0);

  // Subscriptions to friends & friend requests
  useEffect(() => {
    if (!user) {
      setFriends([]);
      setPendingRequests([]);
      return;
    }

    const unsubFriends = subscribeToFriends(user.uid, (data) => {
      setFriends(data);
    });

    const unsubRequests = subscribeToPendingRequests(user.uid, (reqs) => {
      setPendingRequests(reqs);
    });

    return () => {
      unsubFriends();
      unsubRequests();
    };
  }, [user, friendsReloadKey]);

  // Handle Accept Request
  const handleAccept = async (req: FriendRequest) => {
    if (!user) return;
    await acceptFriendRequest(req, profileFromUser(user));
  };

  // Handle Reject Request
  const handleReject = async (requestId: string) => {
    await rejectFriendRequest(requestId, user?.uid);
  };

  // Handle Remove Friend
  const handleRemove = async (friend: FriendUser) => {
    if (!user) return;

    // Immediate optimistic local state removal
    setFriends((prev) => prev.filter((f) => f.uid !== friend.uid && f.cyberpunkId !== friend.cyberpunkId));
    setSelectedFriendUid(null);
    if (activeChatFriendUid === friend.uid) setActiveChatFriendUid(null);

    try {
      await removeFriend(user.uid, friend.uid);
      // NPC removal não dispara Realtime → sincroniza o estado local com o storage
      if (friend.uid.startsWith('npc_')) {
        setFriendsReloadKey((k) => k + 1);
      }
    } catch {
      // Melhor esforço, como antes: o Realtime traz a lista de volta como ela está no banco.
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        title="Rede de Amigos"
        className="w-full mt-2 py-2.5 bg-raised hover:bg-raised-strong text-accent-400 rounded-lg border border-accent-500/30 flex items-center justify-center relative transition-all cursor-pointer"
      >
        <Users className="w-4 h-4" />
        {pendingRequests.length > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-signal-400 rounded-full animate-ping" />
        )}
      </button>
    );
  }

  return (
    <div className="mt-2.5 bg-surface/90 border border-accent-500/30 rounded-xl p-2.5 backdrop-blur-sm relative transition-all">
      {/* Friends List Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 text-fg hover:text-accent-400 transition-colors cursor-pointer text-left"
        >
          <div className="p-1 bg-accent-950/60 border border-accent-500/40 rounded text-accent-400">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-mini font-black uppercase tracking-caps block text-fg">
              AMIGOS <span className="text-accent-400 font-mono">({friends.length})</span>
            </span>
            {pendingRequests.length > 0 && (
              <span className="text-micro font-bold text-signal-400 block animate-pulse">
                • {pendingRequests.length} SOLICITAÇÃO(ÕES)
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowAddModal(!showAddModal)}
            title="Adicionar por ID"
            className="px-2 py-1 bg-accent-950 hover:bg-accent-900 border border-accent-500/50 rounded text-micro font-bold text-accent-300 flex items-center space-x-1 cursor-pointer transition-all hover:shadow-glow-10 hover:shadow-accent-500/30"
          >
            <UserPlus className="w-3 h-3 text-accent-400" />
            <span>+ ADICIONAR</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-muted hover:text-fg rounded transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Add Friend Panel / Search Form */}
      {showAddModal && user && (
        <AddFriendPanel
          user={user}
          friends={friends}
          pendingRequests={pendingRequests}
          onClose={() => setShowAddModal(false)}
          onNpcFriendAdded={() => setFriendsReloadKey((k) => k + 1)}
        />
      )}

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <PendingRequests
          requests={pendingRequests}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      {/* Friends Expandable List Body */}
      {isExpanded && (
        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-0.5 animate-fadeIn">
          {friends.length === 0 ? (
            <div className="text-center py-3 bg-raised/50 rounded border border-line">
              <span className="text-micro text-muted block">
                NENHUM AMIGO ADICIONADO
              </span>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-1 text-micro text-accent-400 underline font-bold cursor-pointer"
              >
                Adicionar por ID
              </button>
            </div>
          ) : (
            friends.map((friend) => {
              const isMenuOpen = selectedFriendUid === friend.uid;
              const isChatOpen = activeChatFriendUid === friend.uid;

              return (
                <div key={friend.uid} className="space-y-1">
                  {/* Friend Main Row Item (Clicking opens menu) */}
                  <div
                    onClick={() => setSelectedFriendUid(isMenuOpen ? null : friend.uid)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                      isMenuOpen || isChatOpen
                        ? 'bg-raised border-accent-500/60 shadow-glow-10 shadow-accent-500/20'
                        : 'bg-raised/80 hover:bg-raised border-line hover:border-accent-500/30'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-7 h-7 rounded bg-surface border border-line-strong flex items-center justify-center shrink-0">
                        <FriendAvatar iconKey={friend.avatarIcon} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 leading-tight">
                          <span className="text-mini font-bold text-fg-strong truncate block">
                            {friend.displayName}
                          </span>
                          <span className="text-micro font-mono text-accent-300 bg-accent-950/80 px-1 py-0.2 rounded border border-accent-500/40 shrink-0">
                            {friend.cyberpunkId}
                          </span>
                        </div>
                        <FriendStatus status={friend.status} />
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 text-muted">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMenuOpen ? 'rotate-180 text-accent-400' : ''}`} />
                    </div>
                  </div>

                  {/* Options Menu directly under friend button */}
                  {isMenuOpen && (
                    <div className="p-1.5 bg-black/90 border border-accent-500/40 rounded-lg flex items-center space-x-1.5 animate-fadeIn">
                      <button
                        onClick={() => {
                          setActiveChatFriendUid(isChatOpen ? null : friend.uid);
                        }}
                        className={`flex-1 py-1 px-2 rounded text-micro font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-all ${
                          isChatOpen
                            ? 'bg-accent-500 text-black border border-accent-400 shadow-glow-8 shadow-accent-500/40'
                            : 'bg-accent-950/80 hover:bg-accent-900 text-accent-300 border border-accent-500/40'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>{isChatOpen ? 'FECHAR CHAT' : 'CONVERSAR'}</span>
                      </button>

                      <button
                        onClick={() => handleRemove(friend)}
                        className="py-1 px-2 bg-fault-950/80 hover:bg-fault-900 text-fault-300 border border-fault-500/40 hover:border-fault-500 rounded text-micro font-bold flex items-center justify-center space-x-1 cursor-pointer transition-all"
                      >
                        <UserX className="w-3 h-3 text-fault-400" />
                        <span>DESFAZER AMIZADE</span>
                      </button>
                    </div>
                  )}

                  {/* Chat Box opens directly below the friend item */}
                  {isChatOpen && user && (
                    <FriendChatBox
                      currentUser={user}
                      friend={friend}
                      onClose={() => setActiveChatFriendUid(null)}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
