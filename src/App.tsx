import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CyberpunkMenu, TabType } from './components/CyberpunkMenu';
import { AuthModal } from './features/social/AuthModal';
import { useCharacterSheet } from './hooks/useCharacterSheet';
import { useUserActivity } from './hooks/useUserActivity';
import { useSheetStore, syncSheetStore } from './stores/useSheetStore';
import { useRollStore } from './stores/useRollStore';
import { useUiStore } from './stores/useUiStore';
import { signOut, supabase } from './lib/supabase';
// Fase 7 (T7.1) — mapas de rota ↔ aba do menu
import { pathToTab, tabToPath } from './router';
import { APP_VERSION } from './version';
import { errorMessage } from './lib/errorMessage';
// L.3d — os cortes do mapa da G.1f: a faixa de título, as rotas, os dois avisos
// flutuantes e as rolagens da ficha moram cada um no seu arquivo.
import { AppPageHeader } from './components/AppPageHeader';
import { AppRoutes } from './components/AppRoutes';
import { RollBanner } from './components/RollBanner';
import { SaveToastBanner } from './components/SaveToastBanner';
import { useSheetRollHandlers } from './hooks/useSheetRollHandlers';

export default function App() {
  // Fase 4 (T4.1/T4.2) — estado global via Zustand (sem prop drilling)
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const isAuthModalOpen = useUiStore((s) => s.isAuthModalOpen);
  const closeAuthModal = useUiStore((s) => s.closeAuthModal);
  const saveToast = useUiStore((s) => s.saveToast);
  const isSavingSheet = useUiStore((s) => s.isSavingSheet);

  const lastRollBanner = useRollStore((s) => s.lastRollBanner);

  const sheet = useSheetStore((s) => s.sheet);
  const user = useSheetStore((s) => s.user);

  // Persistência da ficha: o hook continua como fonte de verdade (cloud +
  // localStorage + autosave) e espelha o estado na useSheetStore.
  const sheetResult = useCharacterSheet();
  syncSheetStore(sheetResult);
  const { saveCurrentSheet, saveCurrentSheetAndReset, resetToBlankSheet } = sheetResult;

  // Activity status tracking (online, inativo after 1min, em jogo when in multiplayer tab)
  const activityStatus = useUserActivity(user?.uid, activeTab === 'multiplayer');

  // Fase 7 (T7.1) — URL ↔ aba ativa: navegar muda a URL e a URL destaca o menu.
  const location = useLocation();
  const navigate = useNavigate();
  // Guarda a aba que veio da URL — cliques no menu (que mudam activeTab sem
  // URL) precisam navegar; mudanças de aba causadas pela URL não podem.
  const tabFromUrlRef = useRef<TabType | null>(null);
  // No primeiro render a URL já é a fonte de verdade — o efeito "aba→URL" não
  // pode navegar (senão um deep link /room/NC-2020 seria redirecionado para /).
  const isFirstRenderRef = useRef(true);

  // URL → aba (deep links e reload mantêm o destaque do menu correto)
  useEffect(() => {
    const tab = pathToTab(location.pathname);
    if (tab) {
      tabFromUrlRef.current = tab;
      setActiveTab(tab);
    }
  }, [location.pathname, setActiveTab]);

  // aba → URL (cliques no menu / onNavigate / onNavigateToSheetCreator)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return; // mount: a URL manda — não redirecionar
    }
    if (activeTab === tabFromUrlRef.current) return; // veio da URL — não navegar
    const path = tabToPath(activeTab);
    if (path) navigate(path);
  }, [activeTab, navigate]);

  const handleSaveCurrentSheet = async () => {
    if (!user) {
      useUiStore.getState().openAuthModal();
      return;
    }
    useUiStore.getState().setSavingSheet(true);
    try {
      const savedHandle = await saveCurrentSheet();
      useUiStore.getState().showSaveToast(`Ficha de "${savedHandle}" foi atualizada e salva no seu perfil com sucesso!`);
    } catch (e) {
      useUiStore.getState().showSaveToast(`Ficha salva localmente no navegador! Aviso da nuvem: ${errorMessage(e, 'Erro de conexão')}`);
    } finally {
      useUiStore.getState().setSavingSheet(false);
    }
  };

  const handleSaveAndResetSheet = async () => {
    if (!user) {
      useUiStore.getState().openAuthModal();
      return;
    }
    useUiStore.getState().setSavingSheet(true);
    try {
      const savedHandle = await saveCurrentSheetAndReset();
      useUiStore.getState().showSaveToast(`Ficha de "${savedHandle}" salva! Formulário limpo e novo personagem em branco iniciado.`);
    } catch (e) {
      useUiStore.getState().showSaveToast(`Ficha salva localmente no navegador! Aviso da nuvem: ${errorMessage(e, 'Erro de conexão')}`);
    } finally {
      useUiStore.getState().setSavingSheet(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(supabase);
      resetToBlankSheet();
    } catch (e) {
      // L.5 — o log no console não chegava a quem clicou em "Sair".
      useUiStore.getState().showSaveToast(`Não foi possível sair: ${errorMessage(e, 'Erro de conexão')}`);
    }
  };

  // Rolagens da ficha (Fase C). As parcelas saem de src/rules/rolls.ts — as
  // MESMAS funções que a mesa usa no servidor (paridade da C.10).
  const rolls = useSheetRollHandlers();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,_var(--color-raised)_0%,_var(--color-surface)_100%)] text-fg font-sans selection:bg-accent-500 selection:text-black relative">
      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
      />

      {/* Floating Roll Notification Banner */}
      <RollBanner banner={lastRollBanner} />

      {/* Floating Save Sheet Toast Notification */}
      <SaveToastBanner message={saveToast} />

      {/* CYBERPUNK 2077 HUD LAYOUT CONTAINER */}
      <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row min-h-screen">
        {/* LEFT COLUMN: CYBERPUNK 2077 VERTICAL MENU & PATCH NOTES */}
        <CyberpunkMenu
          activityStatus={activityStatus}
          onOpenAuth={() => useUiStore.getState().openAuthModal()}
          onLogout={handleLogout}
        />

        {/* RIGHT COLUMN: ACTIVE MODULE WORKSPACE */}
        <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-6 space-y-6">
          {/* Top Page Header Bar */}
          <AppPageHeader
            activeTab={activeTab}
            isLoggedIn={Boolean(user)}
            handleName={sheet.handle}
            role={sheet.role}
          />

          {/* Main Content Render Area */}
          <main className="flex-1">
            {/* Fase 7 (T7.1) — rotas com lazy loading (URLs reais + deep links) */}
            <AppRoutes
              sheetResult={sheetResult}
              sheet={sheet}
              user={user}
              isSavingSheet={isSavingSheet}
              activityStatus={activityStatus}
              onSave={handleSaveCurrentSheet}
              onSaveAndReset={handleSaveAndResetSheet}
              onLogout={handleLogout}
              rolls={rolls}
            />
          </main>

          {/* Immersive Footer Bar */}
          <footer className="print:hidden border-t border-line/80 bg-surface/80 backdrop-blur-md py-4 text-xs font-mono text-subtle rounded-lg p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-2">
              <div className="flex items-center space-x-6 uppercase tracking-caps text-micro">
                <span className="text-accent-400">CYBERPUNK 2020 ENGINE</span>
                <span className="hover:text-fg-soft">R. TALSORIAN GAMES</span>
                <span className="hover:text-fg-soft">NETRUNNER AI LINK</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-ok-500 shadow-glow-5 shadow-ok-500"></div>
                  <span className="text-ok-500 text-micro uppercase">SUPABASE CLOUD CONECTADO</span>
                </div>
                <span className="border-l border-line pl-4 text-micro">{APP_VERSION}</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
