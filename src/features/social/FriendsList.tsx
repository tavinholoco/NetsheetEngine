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
    <div className="mt-2 bg-black/95 border border-cyan-500/60 rounded-lg p-2 space-y-2 animate-fadeIn shadow-[0_0_15px_rgba(6,182,212,0.15)]">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/30 pb-1.5">
        <div className="flex items-center space-x-1.5 min-w-0">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-[10px] font-bold text-cyan-300 font-mono uppercase truncate">
            CHAT // {friend.displayName}
          </span>
          <span className="text-[9px] font-mono font-bold text-slate-300 bg-cyan-950 px-1 py-0.2 rounded border border-cyan-500/40 shrink-0">
            {friend.cyberpunkId}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* NPC Cyberpunk Badge Notice */}
      {isNpc && (
        <div className="bg-yellow-950/40 border border-yellow-500/30 px-2 py-1 rounded text-[9px] font-mono text-yellow-300 flex items-center space-x-1">
          <Bot className="w-3 h-3 text-yellow-400 shrink-0" />
          <span>SISTEMA NET: IA de {friend.displayName} ativa em Night City</span>
        </div>
      )}

      {/* Messages Scroll Box */}
      <div className="h-40 overflow-y-auto custom-scrollbar space-y-2 p-1.5 bg-slate-950/90 rounded border border-slate-900">
        {messages.length === 0 ? (
          <div className="text-center py-6 text-[10px] text-slate-500 font-mono">
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
                <div className="flex items-center space-x-1 text-[8px] font-mono text-slate-400 mb-0.5">
                  <span className={isMe ? 'text-cyan-400 font-bold' : 'text-yellow-400 font-bold'}>
                    {isMe ? 'VOCÊ' : msg.senderName}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`max-w-[88%] px-2.5 py-1.5 rounded text-[11px] leading-relaxed break-words font-sans ${
                    isMe
                      ? 'bg-cyan-950 text-cyan-100 border border-cyan-500/50 rounded-br-none shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                      : 'bg-slate-900 text-slate-100 border border-slate-700 rounded-bl-none'
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
          className="flex-1 bg-slate-950 border border-cyan-500/40 text-slate-100 px-2.5 py-1 rounded text-[11px] focus:border-cyan-400 focus:outline-none placeholder:text-slate-600 font-sans"
        />
        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[10px] rounded uppercase flex items-center space-x-1 cursor-pointer transition-all disabled:opacity-40"
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
        return <Shield className="w-3.5 h-3.5 text-cyan-400" />;
      case 'skull':
        return <Skull className="w-3.5 h-3.5 text-red-400" />;
      case 'bot':
        return <Bot className="w-3.5 h-3.5 text-yellow-400" />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Cpu className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  // Helper for status badge
  const renderStatus = (status: string) => {
    let color = 'text-emerald-400';
    let label = 'ONLINE';
    if (status === 'em jogo') {
      color = 'text-cyan-400';
      label = 'EM JOGO';
    } else if (status === 'inativo') {
      color = 'text-yellow-400';
      label = 'INATIVO';
    } else if (status === 'offline') {
      color = 'text-slate-500';
      label = 'OFFLINE';
    }

    return (
      <div className="flex items-center space-x-1 text-[9px]">
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
        className="w-full mt-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-cyan-400 rounded-lg border border-cyan-500/30 flex items-center justify-center relative transition-all cursor-pointer"
      >
        <Users className="w-4 h-4" />
        {pendingRequests.length > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-ping" />
        )}
      </button>
    );
  }

  return (
    <div className="mt-2.5 bg-slate-950/90 border border-red-500/30 rounded-xl p-2.5 backdrop-blur-sm relative transition-all">
      {/* Friends List Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 text-slate-200 hover:text-cyan-400 transition-colors cursor-pointer text-left"
        >
          <div className="p-1 bg-cyan-950/60 border border-cyan-500/40 rounded text-cyan-400">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider block text-slate-200">
              AMIGOS <span className="text-cyan-400 font-mono">({friends.length})</span>
            </span>
            {pendingRequests.length > 0 && (
              <span className="text-[9px] font-bold text-yellow-400 block animate-pulse">
                • {pendingRequests.length} SOLICITAÇÃO(ÕES)
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowAddModal(!showAddModal)}
            title="Adicionar por ID"
            className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 rounded text-[10px] font-bold text-cyan-300 flex items-center space-x-1 cursor-pointer transition-all hover:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
          >
            <UserPlus className="w-3 h-3 text-cyan-400" />
            <span>+ ADICIONAR</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Add Friend Panel / Search Form */}
      {showAddModal && (
        <div className="mt-2.5 p-2 bg-slate-900/95 border border-cyan-500/40 rounded-lg space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold uppercase tracking-wide">
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
              className="text-slate-400 hover:text-red-400 cursor-pointer"
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
              className="flex-1 bg-black/80 border border-slate-700 text-slate-100 px-2 py-1 rounded text-[11px] font-mono focus:border-cyan-400 focus:outline-none placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[10px] rounded uppercase cursor-pointer transition-all disabled:opacity-50"
            >
              {searching ? '...' : 'BUSCAR'}
            </button>
          </form>

          {/* Quick Demo Suggestions */}
          {!searchResult && !searchError && (
            <div className="pt-1 border-t border-slate-800">
              <span className="text-[9px] text-slate-500 block mb-1 uppercase font-mono">
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
                    className="text-[9px] bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-slate-300 px-1.5 py-0.5 rounded font-mono flex items-center space-x-1 cursor-pointer"
                  >
                    <span className="text-cyan-400 font-bold">{demo.cyberpunkId}</span>
                    <span className="text-slate-400">({demo.displayName})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Error */}
          {searchError && (
            <div className="text-[10px] text-red-400 font-mono bg-red-950/40 p-1.5 rounded border border-red-500/30">
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
              <div className="p-2 bg-slate-950 border border-cyan-500/50 rounded space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded bg-slate-900 border border-cyan-500/30 flex items-center justify-center shrink-0">
                      {renderAvatar(searchResult.avatarIcon)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-100 block leading-tight">
                        {searchResult.displayName}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-300 font-bold">
                        {searchResult.cyberpunkId}
                      </span>
                    </div>
                  </div>

                  {isAlreadyFriend ? (
                    <span className="px-2 py-1 bg-yellow-950/90 text-yellow-400 border border-yellow-500/60 font-mono font-bold text-[9px] rounded uppercase flex items-center space-x-1 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                      <Check className="w-3 h-3 text-yellow-400" />
                      <span>JÁ É AMIGO</span>
                    </span>
                  ) : isPendingReq ? (
                    <span className="px-2 py-1 bg-cyan-950/90 text-cyan-400 border border-cyan-500/60 font-mono font-bold text-[9px] rounded uppercase flex items-center space-x-1 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>PENDENTE</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(searchResult)}
                      disabled={searching}
                      className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] rounded uppercase flex items-center space-x-1 cursor-pointer transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] disabled:opacity-50"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>ADICIONAR</span>
                    </button>
                  )}
                </div>

                {isAlreadyFriend && (
                  <div className="text-[9px] text-yellow-400/90 font-mono bg-yellow-950/30 p-1.5 rounded border border-yellow-500/30">
                    Aviso: Este Edgerunner ({searchResult.cyberpunkId}) já está na sua lista de amigos.
                  </div>
                )}
              </div>
            );
          })()}

          {actionFeedback && (
            <div className="text-[10px] text-cyan-300 font-mono text-center pt-0.5">
              {actionFeedback}
            </div>
          )}
        </div>
      )}

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="mt-2 space-y-1 bg-yellow-950/30 border border-yellow-500/40 p-2 rounded-lg">
          <span className="text-[10px] font-black text-yellow-400 uppercase tracking-wider block">
            PENDENTES ({pendingRequests.length})
          </span>
          <div className="space-y-1.5">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between bg-slate-950/90 p-1.5 rounded border border-yellow-500/30"
              >
                <div className="flex items-center space-x-1.5 min-w-0">
                  <div className="w-6 h-6 rounded bg-slate-900 border border-yellow-500/30 flex items-center justify-center shrink-0">
                    {renderAvatar(req.senderAvatar)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-100 block truncate">
                      {req.senderName}
                    </span>
                    <span className="text-[9px] font-mono text-cyan-400 font-bold block">
                      {req.senderCyberpunkId}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => handleAccept(req)}
                    title="Aceitar"
                    className="p-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/50 rounded transition-all cursor-pointer"
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
            <div className="text-center py-3 bg-slate-900/50 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono block">
                NENHUM AMIGO ADICIONADO
              </span>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-1 text-[10px] text-cyan-400 underline font-bold cursor-pointer"
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
                        ? 'bg-slate-900 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                        : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-cyan-500/30'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-7 h-7 rounded bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0">
                        {renderAvatar(friend.avatarIcon)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 leading-tight">
                          <span className="text-[11px] font-bold text-slate-100 truncate block">
                            {friend.displayName}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950/80 px-1 py-0.2 rounded border border-cyan-500/40 shrink-0">
                            {friend.cyberpunkId}
                          </span>
                        </div>
                        {renderStatus(friend.status)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 text-slate-400">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMenuOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                    </div>
                  </div>

                  {/* Options Menu directly under friend button */}
                  {isMenuOpen && (
                    <div className="p-1.5 bg-black/90 border border-cyan-500/40 rounded-lg flex items-center space-x-1.5 animate-fadeIn">
                      <button
                        onClick={() => {
                          setActiveChatFriendUid(isChatOpen ? null : friend.uid);
                        }}
                        className={`flex-1 py-1 px-2 rounded text-[10px] font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-all ${
                          isChatOpen
                            ? 'bg-cyan-500 text-black border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                            : 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>{isChatOpen ? 'FECHAR CHAT' : 'CONVERSAR'}</span>
                      </button>

                      <button
                        onClick={() => handleRemove(friend)}
                        className="py-1 px-2 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/40 hover:border-red-500 rounded text-[10px] font-bold flex items-center justify-center space-x-1 cursor-pointer transition-all"
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
