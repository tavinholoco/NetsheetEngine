import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Clock,
  Wifi,
  Shield,
  Cpu,
  Skull,
  Bot,
  Zap,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Send,
  MessageSquare,
  UserX,
  MoreVertical,
  MessageCircle
} from 'lucide-react';
import {
  User,
  UserProfileData,
  FriendUser,
  FriendRequest,
  DirectMessage,
  searchUserByCyberpunkId,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  subscribeToFriends,
  subscribeToPendingRequests,
  generateCyberpunkId,
  getChatRoomId,
  sendDirectMessage,
  subscribeToDirectMessages,
  DEMO_CYBERPUNK_USERS
} from '../../lib/supabase';

interface FriendsListProps {
  user: User | null;
  isMinimized?: boolean;
}

interface FriendChatBoxProps {
  currentUser: User;
  friend: FriendUser;
  onClose: () => void;
}

// Inline Cyberpunk Chat Component for Friends / NPCs
export const FriendChatBox: React.FC<FriendChatBoxProps> = ({ currentUser, friend, onClose }) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatRoomId = getChatRoomId(currentUser.uid, friend.uid);

  useEffect(() => {
    const unsub = subscribeToDirectMessages(chatRoomId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [chatRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText('');
    setSending(true);

    const senderName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Edgerunner';
    await sendDirectMessage(currentUser.uid, senderName, friend.uid, textToSend);
    setSending(false);
  };

  const isNpc = friend.uid.startsWith('npc_');

  return (
    <div className="mt-2 bg-black/95 border border-accent-500/60 rounded-lg p-2 space-y-2 animate-fadeIn shadow-glow-15 shadow-accent-500/15">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-accent-500/30 pb-1.5">
        <div className="flex items-center space-x-1.5 min-w-0">
          <MessageSquare className="w-3.5 h-3.5 text-accent-400 shrink-0" />
          <span className="text-micro text-accent-300 font-mono uppercase truncate">
            CHAT // {friend.displayName}
          </span>
          <span className="text-micro font-mono text-fg-soft bg-accent-950 px-1 py-0.2 rounded border border-accent-500/40 shrink-0">
            {friend.cyberpunkId}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* NPC Cyberpunk Badge Notice */}
      {isNpc && (
        <div className="bg-signal-950/40 border border-signal-500/30 px-2 py-1 rounded text-micro text-signal-300 flex items-center space-x-1">
          <Bot className="w-3 h-3 text-signal-400 shrink-0" />
          <span>SISTEMA NET: IA de {friend.displayName} ativa em Night City</span>
        </div>
      )}

      {/* Messages Scroll Box */}
      <div className="h-40 overflow-y-auto custom-scrollbar space-y-2 p-1.5 bg-surface/90 rounded border border-line-soft">
        {messages.length === 0 ? (
          <div className="text-center py-6 text-micro text-subtle">
            Nenhuma mensagem trocada ainda. Envie um ping no HoloNet!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderUid === currentUser.uid;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center space-x-1 text-micro font-mono text-muted mb-0.5">
                  <span className={isMe ? 'text-accent-400' : 'text-signal-400'}>
                    {isMe ? 'VOCÊ' : msg.senderName}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`max-w-[88%] px-2.5 py-1.5 rounded text-mini leading-relaxed break-words font-sans ${
                    isMe
                      ? 'bg-accent-950 text-accent-100 border border-accent-500/50 rounded-br-none shadow-glow-8 shadow-accent-500/15'
                      : 'bg-raised text-fg-strong border border-line-strong rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Form */}
      <form onSubmit={handleSend} className="flex space-x-1 pt-1">
        <input
          type="text"
          placeholder={`Digitar para ${friend.displayName}...`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-surface border border-accent-500/40 text-fg-strong px-2.5 py-1 rounded text-mini focus:border-accent-400 focus:outline-none placeholder:text-faint font-sans"
        />
        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="px-2.5 py-1 bg-accent-500 hover:bg-accent-400 text-black font-black text-micro rounded uppercase flex items-center space-x-1 cursor-pointer transition-all disabled:opacity-40"
        >
          <Send className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
};

export const FriendsList: React.FC<FriendsListProps> = ({ user, isMinimized = false }) => {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  
  // Interactive friend menu & chat state
  const [selectedFriendUid, setSelectedFriendUid] = useState<string | null>(null);
  const [activeChatFriendUid, setActiveChatFriendUid] = useState<string | null>(null);

  // Search state
  const [searchIdInput, setSearchIdInput] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<Omit<FriendUser, 'addedAt'> | null>(null);
  const [searchError, setSearchError] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<string>('');

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
        if (user && result.uid === user.uid) {
          setSearchError('Este é o seu próprio ID de Edgerunner.');
        } else {
          setSearchResult(result);
        }
      } else {
        setSearchError('Edgerunner não encontrado com este ID.');
      }
    } catch (err) {
      setSearchError('Erro ao buscar ID na rede de Night City.');
    } finally {
      setSearching(false);
    }
  };

  // Handle Sending Request with strict duplicate detection
  const handleSendRequest = async (target: Omit<FriendUser, 'addedAt'>) => {
    if (!user) return;

    // Check if target is already in local friends list
    const isAlreadyFriend = friends.some(
      (f) => f.uid === target.uid || f.cyberpunkId.toUpperCase() === target.cyberpunkId.toUpperCase()
    );
    if (isAlreadyFriend) {
      setActionFeedback(`Atenção: O Edgerunner ${target.displayName} (${target.cyberpunkId}) já está na sua lista de amigos!`);
      return;
    }

    // Check if request is already pending
    const isPendingReq = pendingRequests.some(
      (r) => r.senderUid === target.uid || r.receiverUid === target.uid
    );
    if (isPendingReq) {
      setActionFeedback(`Aviso: Já existe uma solicitação de amizade pendente para ${target.displayName}.`);
      return;
    }

    setSearching(true);
    setActionFeedback('Processando na rede...');
    
    const senderProfile: UserProfileData = {
      uid: user.uid,
      cyberpunkId: generateCyberpunkId(user.uid),
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'Edgerunner',
      bio: '',
      avatarIcon: 'cpu',
      avatarUrl: '',
      status: 'online'
    };

    try {
      const res = await sendFriendRequest(senderProfile, target);
      setActionFeedback(res.message);
      if (res.success) {
        // NPCs não disparam Realtime (ficam em localStorage) → força refresh da lista
        if (target.uid.startsWith('npc_')) {
          setFriendsReloadKey((k) => k + 1);
        }
        setTimeout(() => {
          setSearchResult(null);
          setSearchIdInput('');
          setActionFeedback('');
        }, 3000);
      }
    } catch (err) {
      setActionFeedback('Erro ao comunicar com a rede.');
    } finally {
      setSearching(false);
    }
  };

  // Handle Accept Request
  const handleAccept = async (req: FriendRequest) => {
    if (!user) return;
    const currentUserProfile: UserProfileData = {
      uid: user.uid,
      cyberpunkId: generateCyberpunkId(user.uid),
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'Edgerunner',
      bio: '',
      avatarIcon: 'cpu',
      avatarUrl: '',
      status: 'online'
    };
    await acceptFriendRequest(req, currentUserProfile);
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
    } catch (err) {
      console.error('Erro ao desfazer amizade:', err);
    }
  };

  // Helper for rendering avatar icons
  const renderAvatar = (iconName: string) => {
    switch (iconName) {
      case 'shield':
        return <Shield className="w-3.5 h-3.5 text-accent-400" />;
      case 'skull':
        return <Skull className="w-3.5 h-3.5 text-red-400" />;
      case 'bot':
        return <Bot className="w-3.5 h-3.5 text-signal-400" />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5 text-ok-400" />;
      default:
        return <Cpu className="w-3.5 h-3.5 text-ok-400" />;
    }
  };

  // Helper for status badge
  const renderStatus = (status: string) => {
    let color = 'text-ok-400';
    let label = 'ONLINE';
    if (status === 'em jogo') {
      color = 'text-accent-400';
      label = 'EM JOGO';
    } else if (status === 'inativo') {
      color = 'text-signal-400';
      label = 'INATIVO';
    } else if (status === 'offline') {
      color = 'text-subtle';
      label = 'OFFLINE';
    }

    return (
      <div className="flex items-center space-x-1 text-micro">
        <Wifi className={`w-2.5 h-2.5 ${color}`} />
        <span className={`font-bold uppercase ${color}`}>{label}</span>
      </div>
    );
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
    <div className="mt-2.5 bg-surface/90 border border-red-500/30 rounded-xl p-2.5 backdrop-blur-sm relative transition-all">
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
      {showAddModal && (
        <div className="mt-2.5 p-2 bg-raised/95 border border-accent-500/40 rounded-lg space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-micro text-accent-400 font-bold uppercase tracking-caps">
            <span className="flex items-center space-x-1">
              <Search className="w-3 h-3" />
              <span>BUSCAR EDGERUNNER POR ID</span>
            </span>
            <button
              onClick={() => {
                setShowAddModal(false);
                setSearchResult(null);
                setSearchError('');
              }}
              className="text-muted hover:text-red-400 cursor-pointer"
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
              className="flex-1 bg-black/80 border border-line-strong text-fg-strong px-2 py-1 rounded text-mini font-mono focus:border-accent-400 focus:outline-none placeholder:text-faint"
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
            <div className="text-micro text-red-400 bg-red-950/40 p-1.5 rounded border border-red-500/30">
              {searchError}
            </div>
          )}

          {/* Search Result Box */}
          {searchResult && (() => {
            const isAlreadyFriend = friends.some(
              (f) => f.uid === searchResult.uid || f.cyberpunkId.toUpperCase() === searchResult.cyberpunkId.toUpperCase()
            );
            const isPendingReq = pendingRequests.some(
              (r) => r.senderUid === searchResult.uid || r.receiverUid === searchResult.uid
            );

            return (
              <div className="p-2 bg-surface border border-accent-500/50 rounded space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded bg-raised border border-accent-500/30 flex items-center justify-center shrink-0">
                      {renderAvatar(searchResult.avatarIcon)}
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
      )}

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="mt-2 space-y-1 bg-signal-950/30 border border-signal-500/40 p-2 rounded-lg">
          <span className="text-micro font-black text-signal-400 uppercase tracking-caps block">
            PENDENTES ({pendingRequests.length})
          </span>
          <div className="space-y-1.5">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between bg-surface/90 p-1.5 rounded border border-signal-500/30"
              >
                <div className="flex items-center space-x-1.5 min-w-0">
                  <div className="w-6 h-6 rounded bg-raised border border-signal-500/30 flex items-center justify-center shrink-0">
                    {renderAvatar(req.senderAvatar)}
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
                    onClick={() => handleAccept(req)}
                    title="Aceitar"
                    className="p-1 bg-ok-500/20 hover:bg-ok-500/40 text-ok-400 border border-ok-500/50 rounded transition-all cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    title="Recusar"
                    className="p-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/50 rounded transition-all cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                        {renderAvatar(friend.avatarIcon)}
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
                        {renderStatus(friend.status)}
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
                        className="py-1 px-2 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/40 hover:border-red-500 rounded text-micro font-bold flex items-center justify-center space-x-1 cursor-pointer transition-all"
                      >
                        <UserX className="w-3 h-3 text-red-400" />
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
