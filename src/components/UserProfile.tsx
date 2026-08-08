import React, { useEffect, useRef, useState } from 'react';
import {
  SheetMeta,
  fetchUserProfile,
  uploadAvatar,
  removeAvatar
} from '../lib/supabase';
import { ActivityStatus } from '../hooks/useUserActivity';
import {
  User as UserIcon,
  LogOut,
  Cpu,
  Plus,
  Trash2,
  FileText,
  Lock,
  Upload,
  ImagePlus,
  Loader2,
  XCircle
} from 'lucide-react';

interface UserProfileProps {
  user: { uid: string; displayName?: string | null; email?: string | null } | null;
  authLoading: boolean;
  activityStatus: ActivityStatus;
  roster: SheetMeta[];
  activeSheetId: string;
  onLoadSheet: (id: string) => void;
  onDeleteSheet: (id: string) => void;
  onCreateNewSheet: () => void;
  onOpenAuthModal: () => void;
  onNavigateToSheetCreator: () => void;
  onLogout: () => void;
}

const STATUS_META: Record<ActivityStatus, { label: string; cls: string }> = {
  online: { label: 'ONLINE', cls: 'text-emerald-400 border-emerald-500/60 bg-emerald-950/60' },
  inativo: { label: 'INATIVO', cls: 'text-amber-400 border-amber-500/60 bg-amber-950/60' },
  'em jogo': { label: 'EM JOGO', cls: 'text-purple-400 border-purple-500/60 bg-purple-950/60' }
};

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  authLoading,
  activityStatus,
  roster,
  activeSheetId,
  onLoadSheet,
  onDeleteSheet,
  onCreateNewSheet,
  onOpenAuthModal,
  onNavigateToSheetCreator,
  onLogout
}) => {
  const status = STATUS_META[activityStatus] || STATUS_META['online'];
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega o avatar do perfil (bucket avatars) ao montar / trocar de usuário
  useEffect(() => {
    if (!user) {
      setAvatarUrl('');
      return;
    }
    let active = true;
    fetchUserProfile(user.uid)
      .then((p) => {
        if (active && p) setAvatarUrl(p.avatarUrl || '');
      })
      .catch(() => {
        /* perfil indisponível — mantém estado atual */
      });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const handleFileSelected = async (file: File | undefined) => {
    if (!file || !user) return;
    setAvatarError(null);
    setIsUploading(true);
    try {
      const url = await uploadAvatar(user.uid, file);
      setAvatarUrl(url);
      window.dispatchEvent(new CustomEvent<string>('cyberpunk:avatar-updated', { detail: url }));
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Falha ao enviar avatar.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setAvatarError(null);
    try {
      await removeAvatar(user.uid);
      setAvatarUrl('');
      window.dispatchEvent(new CustomEvent<string>('cyberpunk:avatar-updated', { detail: '' }));
    } catch {
      setAvatarError('Falha ao remover avatar.');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24 font-mono text-slate-500 text-sm">
        Conectando ao perfil...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-slate-950/90 border-2 border-yellow-500/50 rounded-2xl p-10 text-center font-mono space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-900 border-2 border-yellow-500/60 flex items-center justify-center">
          <UserIcon className="w-8 h-8 text-yellow-400" />
        </div>
        <h2 className="text-xl font-black text-yellow-400 uppercase tracking-widest">Perfil de Visitante</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Você está no modo visitante. Crie uma conta ou faça login para salvar fichas na nuvem,
          adicionar amigos e usar o NETRUNNER IA.
        </p>
        <button
          onClick={onOpenAuthModal}
          className="px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase rounded border-2 border-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.5)] transition-all cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 inline mr-1" />
          Acessar Conta // Edgerunner
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-mono animate-fadeIn">
      {/* Cartão do perfil */}
      <div className="bg-slate-950/90 border-l-4 border-amber-400 border-y border-r border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-amber-400 select-none">
          PROFILE
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-slate-900 border-2 border-amber-400/60 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.25)]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={() => setAvatarUrl('')}
              />
            ) : (
              <Cpu className="w-10 h-10 text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-black text-white uppercase tracking-wide">
                {user.displayName || user.email?.split('@')[0] || 'Edgerunner'}
              </h2>
              <span className={`text-[9px] px-2 py-0.5 border rounded font-black uppercase ${status.cls}`}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{user.email || 'Sem e-mail registrado'}</p>
            <p className="text-[10px] text-slate-600 mt-1">UID: {user.uid}</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-950/80 hover:bg-red-900 border border-red-600/60 text-red-300 rounded font-bold text-[10px] uppercase flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Roster */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Minhas Fichas ({roster.length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onNavigateToSheetCreator}
              className="px-2.5 py-1 text-[10px] text-cyan-300 hover:text-white bg-slate-900 border border-slate-700 rounded uppercase flex items-center space-x-1 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Criar Ficha</span>
            </button>
            <button
              onClick={onCreateNewSheet}
              className="px-2.5 py-1 text-[10px] text-emerald-300 hover:text-white bg-slate-900 border border-slate-700 rounded uppercase flex items-center space-x-1 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Nova em Branco</span>
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-900">
          {roster.map((meta) => (
            <div
              key={meta.id}
              className={`flex items-center justify-between px-4 py-3 transition-colors ${
                meta.id === activeSheetId ? 'bg-cyan-950/30 border-l-2 border-l-cyan-400' : 'hover:bg-slate-900/50'
              }`}
            >
              <button onClick={() => onLoadSheet(meta.id)} className="flex items-center space-x-2.5 text-left min-w-0 flex-1 cursor-pointer">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-yellow-400 font-bold shrink-0">
                  {meta.role}
                </span>
                <span className="text-xs font-bold text-white truncate">{meta.handle || 'Sem nome'}</span>
                {meta.id === activeSheetId && (
                  <span className="text-[8px] px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/60 text-cyan-300 rounded font-black uppercase shrink-0">
                    Ativa
                  </span>
                )}
              </button>
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-[9px] text-slate-600">{new Date(meta.updatedAt).toLocaleDateString()}</span>
                <button
                  onClick={() => onDeleteSheet(meta.id)}
                  className="p-1.5 rounded bg-slate-900 hover:bg-red-950 border border-slate-800 hover:border-red-500 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          {roster.length === 0 && (
            <div className="text-center py-8 text-[10px] text-slate-500">
              Nenhuma ficha salva. Crie uma ficha ou use "Nova em Branco".
            </div>
          )}
        </div>
      </div>

      {/* Avatar upload (bucket avatars — T2.17) */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-3">
          <ImagePlus className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] text-amber-400 uppercase font-mono font-black tracking-widest">
            Avatar do Edgerunner
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Cpu className="w-7 h-7 text-slate-500" />
            )}
          </div>
          <div className="flex-1 w-full space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded font-black text-[10px] uppercase flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{isUploading ? 'Enviando...' : 'Enviar Avatar'}</span>
              </button>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={isUploading}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-red-950 border border-slate-700 hover:border-red-500 text-slate-400 hover:text-red-400 rounded font-black text-[10px] uppercase flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Remover</span>
                </button>
              )}
            </div>
            <p className="text-[9px] text-slate-500 leading-relaxed">
              PNG, JPEG, WebP ou GIF · até 5 MB. O avatar aparece no menu e no perfil.
            </p>
            {avatarError && (
              <p className="text-[10px] text-red-400 font-bold">⚠ {avatarError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
