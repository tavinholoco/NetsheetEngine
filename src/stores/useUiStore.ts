/**
 * ============================================================
 * NETSHEET ENGINE — useUiStore (Fase 4 · T4.1)
 * Estado global de UI: aba ativa, modal de auth, toasts e
 * flags de salvamento. Elimina o estado local duplicado no App.tsx.
 * ============================================================
 */
import { create } from 'zustand';
import type { TabType } from '../components/CyberpunkMenu';

interface UiState {
  /** Aba ativa do menu principal. */
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  /** Modal de autenticação. */
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;

  /** Toast de salvamento (botão Salvar Ficha). */
  saveToast: string | null;
  showSaveToast: (msg: string) => void;
  clearSaveToast: () => void;
  /** id do timeout ativo (evita que um timeout antigo limpe um toast novo). */
  _toastTimer: ReturnType<typeof setTimeout> | null;

  /** Flag "Salvando..." do botão. */
  isSavingSheet: boolean;
  setSavingSheet: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'home',
  setActiveTab: (tab) => set({ activeTab: tab }),

  isAuthModalOpen: false,
  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  saveToast: null,
  _toastTimer: null,
  showSaveToast: (msg) => {
    // Se um toast novo aparece antes de 5s, cancela o timer do anterior
    const prev = useUiStore.getState()._toastTimer;
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      useUiStore.getState().clearSaveToast();
    }, 5000);
    set({ saveToast: msg, _toastTimer: timer });
  },
  clearSaveToast: () => {
    const prev = useUiStore.getState()._toastTimer;
    if (prev) clearTimeout(prev);
    set({ saveToast: null, _toastTimer: null });
  },

  isSavingSheet: false,
  setSavingSheet: (v) => set({ isSavingSheet: v })
}));
