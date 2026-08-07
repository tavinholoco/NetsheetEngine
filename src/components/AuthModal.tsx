import React, { useState, useEffect } from 'react';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  googleProvider,
  saveUserProfile,
  updateProfile,
  onAuthStateChanged
} from '../lib/supabase';
import { Shield, Mail, User as UserIcon, Lock, AlertTriangle, Loader2, Sparkles, LogIn, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Flag de OAuth pendente: salva o perfil ao voltar do redirect do Google. */
const OAUTH_PENDING_KEY = 'cyberpunk_oauth_pending';

/** Traduz erros do Supabase Auth para mensagens pt-BR (mantendo o UX do Firebase). */
function translateAuthError(err: any): string {
  const code = String(err?.code || err?.status || '');
  const msg = String(err?.message || err || '');

  if (code === 'invalid_credentials' || msg.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (code === 'email_exists' || code === 'user_already_exists' || msg.includes('already been registered')) {
    return 'Este e-mail já está cadastrado no sistema.';
  }
  if (code === 'weak_password' || msg.toLowerCase().includes('password should be at least')) {
    return 'A senha deve ter no mínimo 6 caracteres.';
  }
  if (code === 'invalid_email' || msg.toLowerCase().includes('invalid email')) {
    return 'Endereço de e-mail inválido.';
  }
  if (code === 'email_not_confirmed' || msg.toLowerCase().includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de acessar (verifique sua caixa de entrada).';
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return 'Muitas tentativas. Aguarde um instante e tente novamente.';
  }
  if (code === 'user_not_found' || msg.toLowerCase().includes('no user found')) {
    return 'E-mail ou senha incorretos.';
  }
  return msg || 'Erro na autenticação. Verifique os dados.';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Retorno do OAuth do Google: quando o usuário volta do redirect, a sessão
  // já está ativa (onAuthStateChanged) e sincronizamos o perfil (display_name).
  // Se o usuário cancelar no Google (volta sem sessão), limpamos a flag para
  // não disparar sync redundante no próximo login.
  useEffect(() => {
    if (!sessionStorage.getItem(OAUTH_PENDING_KEY)) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      if (u) {
        try {
          await saveUserProfile(u);
        } catch (e) {
          console.error('Erro ao sincronizar perfil pós-OAuth:', e);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor, preencha e-mail e senha.');
      return;
    }
    if (isRegister && password.length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (!userCredential.user) {
          // Ex.: cloud com confirmação de e-mail ativa — sessão ainda não existe
          setErrorMsg('Conta criada! Confirme seu e-mail antes de acessar.');
          return;
        }
        if (displayName.trim()) {
          await updateProfile(userCredential.user, { displayName });
        }
        await saveUserProfile(userCredential.user, displayName);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMsg(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fluxo OAuth do Supabase usa redirect: marcamos o pendente para
      // sincronizar o perfil quando o usuário voltar ao app.
      sessionStorage.setItem(OAUTH_PENDING_KEY, '1');
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      setErrorMsg('Falha no login com Google. Verifique se o redirect URI está configurado no Google Console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md bg-slate-950 border border-yellow-500/50 shadow-[0_0_30px_rgba(250,204,21,0.25)]">
        {/* Header */}
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-yellow-400">
            <Shield className="w-5 h-5" />
            <DialogTitle className="text-yellow-400">
              {isRegister ? 'Cadastrar Novo Edgerunner' : 'Autenticação Net-Access'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-400">
            {isRegister
              ? 'Crie sua conta para sincronizar suas fichas na nuvem gratuitamente'
              : 'Faça login para salvar e recuperar suas fichas em qualquer dispositivo'}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="bg-red-950/80 border border-red-800 p-3 rounded text-xs text-red-300 flex items-center space-x-2 font-mono">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-mono">
          {isRegister && (
            <div>
              <label className="text-xs text-slate-400 block mb-1 uppercase">Nome / Handle do Edgerunner:</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 z-10" />
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ex: Johnny Silverhand"
                  className="pl-9 focus-visible:border-yellow-400 focus-visible:ring-yellow-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 block mb-1 uppercase">Endereço de E-mail:</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 z-10" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="edgerunner@nightcity.net"
                required
                className="pl-9 focus-visible:border-yellow-400 focus-visible:ring-yellow-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1 uppercase">Senha do Terminal:</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 z-10" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pl-9 focus-visible:border-yellow-400 focus-visible:ring-yellow-400"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            variant="cyber"
            className="w-full py-2.5 h-auto text-xs uppercase"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Criar Conta Gratuita</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Acessar Conta</span>
              </>
            )}
          </Button>
        </form>

        <div className="relative flex py-1 items-center font-mono">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase">ou acesse com</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          variant="secondary"
          className="w-full py-2 h-auto text-xs"
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Login com Google</span>
        </Button>

        <div className="text-center pt-2 border-t border-slate-800 font-mono">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg(null);
            }}
            className="text-xs text-cyan-400 hover:underline uppercase cursor-pointer"
          >
            {isRegister
              ? 'Já possui uma conta? Faça Login'
              : 'Não tem conta? Cadastre-se gratuitamente'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
