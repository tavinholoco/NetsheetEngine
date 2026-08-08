import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { CyberpunkMenu, TabType } from './components/CyberpunkMenu';
import { AuthModal } from './components/AuthModal';
import { RollResult, StatName } from './types/cyberpunk';
import { useCharacterSheet } from './hooks/useCharacterSheet';
import { useUserActivity } from './hooks/useUserActivity';
import { useSheetStore, syncSheetStore } from './stores/useSheetStore';
import { useRollStore } from './stores/useRollStore';
import { useUiStore } from './stores/useUiStore';
import { firebaseSignOut, auth } from './lib/supabase';
// Fase 6 (T6.3) — motor de dados FNFF (audit trail via @dice-roller)
import { rollSkill, rollDamage, rollDeathSave } from './utils/diceEngine';
// Fase 7 (T7.1) — mapas de rota ↔ aba do menu
import { pathToTab, tabToPath } from './router';
import { Dice5, CheckCircle2 } from 'lucide-react';

// ===========================================================================
// FASE 7 (T7.1) — PÁGINAS COM LAZY LOADING (code-splitting por rota)
// Cada módulo vira um chunk separado no bundle; o Suspense mostra o fallback
// enquanto o chunk carrega.
// ===========================================================================
const HomePageLazy = lazy(() => import('./components/HomePage').then((m) => ({ default: m.HomePage })));
const PrdViewerLazy = lazy(() => import('./components/PrdViewer').then((m) => ({ default: m.PrdViewer })));
const SheetPageLazy = lazy(() => import('./pages/SheetPage').then((m) => ({ default: m.SheetPage })));
const DiceRollerLazy = lazy(() => import('./components/DiceRoller').then((m) => ({ default: m.DiceRoller })));
const AiAssistantLazy = lazy(() => import('./components/AiAssistant').then((m) => ({ default: m.AiAssistant })));
const MultiplayerRoomLazy = lazy(() => import('./components/MultiplayerRoom').then((m) => ({ default: m.MultiplayerRoom })));
const RoomPageLazy = lazy(() => import('./pages/RoomPage').then((m) => ({ default: m.RoomPage })));
const PresetsManagerLazy = lazy(() => import('./components/PresetsManager').then((m) => ({ default: m.PresetsManager })));
const UserProfileLazy = lazy(() => import('./components/UserProfile').then((m) => ({ default: m.UserProfile })));
const NotFoundLazy = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

/** Placeholder exibido enquanto o chunk da rota carrega. */
const RouteFallback: React.FC = () => (
  <div className="flex items-center justify-center py-20 font-mono text-slate-500 animate-pulse">
    <span className="text-xs uppercase tracking-widest">Carregando módulo da Net...</span>
  </div>
);

export default function App() {
  // Fase 4 (T4.1/T4.2) — estado global via Zustand (sem prop drilling)
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const isAuthModalOpen = useUiStore((s) => s.isAuthModalOpen);
  const closeAuthModal = useUiStore((s) => s.closeAuthModal);
  const saveToast = useUiStore((s) => s.saveToast);
  const isSavingSheet = useUiStore((s) => s.isSavingSheet);

  const rollHistory = useRollStore((s) => s.rollHistory);
  const lastRollBanner = useRollStore((s) => s.lastRollBanner);
  const addRoll = useRollStore((s) => s.addRoll);

  const sheet = useSheetStore((s) => s.sheet);
  const user = useSheetStore((s) => s.user);

  // Persistência da ficha: o hook continua como fonte de verdade (cloud +
  // localStorage + autosave) e espelha o estado na useSheetStore.
  const sheetResult = useCharacterSheet();
  syncSheetStore(sheetResult);
  const {
    authLoading,
    roster,
    updateSheet: handleUpdateSheet,
    loadSheet,
    loadPresetAsNewSheet,
    createNewCharacter,
    saveCurrentSheet,
    saveCurrentSheetAndReset,
    deleteCharacter,
    resetToBlankSheet
  } = sheetResult;

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
    } catch (e: any) {
      console.error('Error saving sheet:', e);
      useUiStore.getState().showSaveToast(`Ficha salva localmente no navegador! Aviso da nuvem: ${e?.message || 'Erro de conexão'}`);
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
    } catch (e: any) {
      console.error('Error saving sheet:', e);
      useUiStore.getState().showSaveToast(`Ficha salva localmente no navegador! Aviso da nuvem: ${e?.message || 'Erro de conexão'}`);
    } finally {
      useUiStore.getState().setSavingSheet(false);
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth);
      resetToBlankSheet();
    } catch (e) {
      console.error('Error signing out:', e);
    }
  };

  const handleAddRollResult = (roll: RollResult) => {
    addRoll(roll);
  };

  // Roll Skill directly from Skill section (Fase 6 T6.3 — motor diceEngine)
  const handleRollSkill = (skillName: string, statName: StatName, statVal: number, skillRank: number) => {
    handleAddRollResult(rollSkill(statVal, skillRank, {
      characterName: sheet.handle || 'Edgerunner',
      label: `Rolagem: ${skillName}`,
      statName
    }));
  };

  // Roll Weapon Attack directly
  const handleRollWeaponAttack = (weaponName: string, wa: number, damageStr: string) => {
    const refVal = sheet.stats.REF;
    handleRollSkill(`Ataque com ${weaponName}`, 'REF', refVal, wa);
  };

  // Roll Damage Only (Fase 6 T6.3 — motor diceEngine; fórmula inválida é
  // ignorada silenciosamente, mesmo comportamento de antes)
  const handleRollDamageOnly = (weaponName: string, damageFormula: string) => {
    try {
      handleAddRollResult(rollDamage(damageFormula, {
        characterName: sheet.handle || 'Edgerunner',
        label: `Dano da Arma: ${weaponName}`
      }));
    } catch {
      /* fórmula de dano inválida */
    }
  };

  // Roll Death Save (Fase 6 T6.3 — motor diceEngine)
  const handleRollDeathSave = () => {
    handleAddRollResult(rollDeathSave(sheet.stats.BODY, {
      characterName: sheet.handle || 'Edgerunner'
    }));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,_rgba(15,23,42,1)_0%,_rgba(2,6,23,1)_100%)] text-slate-200 font-sans selection:bg-cyan-500 selection:text-black relative">
      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
      />

      {/* Floating Roll Notification Banner */}
      {lastRollBanner && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-slate-900/90 border-2 border-cyan-400 p-4 rounded-lg shadow-[0_0_25px_rgba(6,182,212,0.5)] animate-bounce text-xs font-mono backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-2">
            <span className="font-bold text-yellow-400 flex items-center space-x-1">
              <Dice5 className="w-4 h-4 text-cyan-400" />
              <span>{lastRollBanner.label}</span>
            </span>
            <span className="text-[10px] text-slate-400">{lastRollBanner.timestamp}</span>
          </div>

          <div className="text-xl font-black text-cyan-300 my-1">
            RESULTADO TOTAL: {lastRollBanner.total}
          </div>

          <p className="text-[11px] text-slate-300">{lastRollBanner.details}</p>
        </div>
      )}

      {/* Floating Save Sheet Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-4 left-4 z-50 max-w-md bg-slate-950 border-2 border-emerald-400 p-4 rounded-lg shadow-[0_0_25px_rgba(16,185,129,0.5)] text-xs font-mono backdrop-blur-sm space-y-1">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold uppercase">
            <CheckCircle2 className="w-4 h-4" />
            <span>Sincronização Concluída</span>
          </div>
          <p className="text-slate-200">{saveToast}</p>
        </div>
      )}

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
          {(() => {
            const pageInfoMap: Record<TabType, { category: string; title: string; color: string }> = {
              home: { category: 'BEM-VINDO', title: 'INÍCIO // CYBERPUNK 2020 NETSHEET ENGINE', color: 'text-yellow-400' },
              multiplayer: { category: 'JOGAR', title: 'MESA MULTIPLAYER EM TEMPO REAL', color: 'text-emerald-400' },
              sheet: { category: 'FICHA', title: 'CRIADOR & GESTOR DE FICHA', color: 'text-cyan-400' },
              presets: { category: 'LENDAS', title: 'BIBLIOTECA DE LENDAS DE NIGHT CITY', color: 'text-yellow-400' },
              ai: { category: 'NETRUNNER', title: 'ASSISTENTE NETRUNNER IA & LIFEPATH', color: 'text-purple-400' },
              dice: { category: 'DADOS', title: 'ROLADOR DE DADOS FNFF & COMBATE', color: 'text-pink-400' },
              prd: { category: 'PRD', title: 'ESPECIFICAÇÃO PRD & ROADMAP', color: 'text-red-400' },
              profile: { category: 'PERFIL', title: 'PERFIL DO EDGERUNNER', color: 'text-amber-400' },
            };
            const currentPage = pageInfoMap[activeTab] || pageInfoMap['home'];

            return (
              <div className="bg-slate-950/90 border-2 border-red-600/40 rounded-xl p-4 md:p-5 font-mono backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.15)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-red-500 via-yellow-500 to-cyan-500"></div>
                <div className="pl-3 space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 bg-red-500 animate-pulse rounded-full shadow-[0_0_8px_rgba(239,68,68,1)]"></div>
                    <span className="text-[11px] font-black tracking-widest text-red-500 uppercase">
                      SISTEMA // {currentPage.category}
                    </span>
                  </div>
                  <h1 className={`text-xl sm:text-2xl md:text-3xl font-black italic tracking-tight uppercase ${currentPage.color} drop-shadow-[0_0_12px_rgba(255,255,255,0.15)] leading-tight`}>
                    {currentPage.title}
                  </h1>
                  {user && (
                    <p className="text-xs text-slate-300 font-medium pt-1 flex items-center space-x-1.5">
                      <span className="text-slate-400">FICHA ATIVA:</span>
                      <strong className="text-yellow-400 font-bold">{sheet.handle || 'Edgerunner'}</strong>
                      <span className="text-cyan-400 font-semibold">({sheet.role || 'Solo'})</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Main Content Render Area */}
          <main className="flex-1">
            {/* Fase 7 (T7.1) — rotas com lazy loading (URLs reais + deep links) */}
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomePageLazy onNavigate={setActiveTab} />} />
                <Route path="/prd" element={<PrdViewerLazy />} />
                <Route
                  path="/sheet"
                  element={
                    <SheetPageLazy
                      sheet={sheet}
                      onChange={handleUpdateSheet}
                      onRollDeathSave={handleRollDeathSave}
                      onRollWeaponAttack={handleRollWeaponAttack}
                      onRollDamageOnly={handleRollDamageOnly}
                      onRollSkill={handleRollSkill}
                      user={user}
                      isSavingSheet={isSavingSheet}
                      onSave={handleSaveCurrentSheet}
                      onSaveAndReset={handleSaveAndResetSheet}
                    />
                  }
                />
                <Route
                  path="/dice"
                  element={
                    <DiceRollerLazy
                      onAddRoll={handleAddRollResult}
                      onClearHistory={() => useRollStore.getState().clearHistory()}
                    />
                  }
                />
                <Route
                  path="/ai"
                  element={
                    <AiAssistantLazy
                      sheet={sheet}
                      onChange={handleUpdateSheet}
                      user={user}
                      onOpenAuthModal={() => useUiStore.getState().openAuthModal()}
                    />
                  }
                />
                <Route
                  path="/multiplayer"
                  element={<MultiplayerRoomLazy onOpenAuthModal={() => useUiStore.getState().openAuthModal()} />}
                />
                <Route
                  path="/room/:code"
                  element={<RoomPageLazy onOpenAuthModal={() => useUiStore.getState().openAuthModal()} />}
                />
                <Route
                  path="/presets"
                  element={
                    <PresetsManagerLazy
                      onLoadSheet={loadSheet}
                      onLoadPresetAsNewSheet={loadPresetAsNewSheet}
                      onCreateNew={createNewCharacter}
                      onDeleteSheet={deleteCharacter}
                      onOpenAuthModal={() => useUiStore.getState().openAuthModal()}
                    />
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <UserProfileLazy
                      activityStatus={activityStatus}
                      onLoadSheet={loadSheet}
                      onDeleteSheet={deleteCharacter}
                      onCreateNewSheet={createNewCharacter}
                      onOpenAuthModal={() => useUiStore.getState().openAuthModal()}
                      onNavigateToSheetCreator={() => useUiStore.getState().setActiveTab('sheet')}
                      onLogout={handleLogout}
                    />
                  }
                />
                <Route path="*" element={<NotFoundLazy />} />
              </Routes>
            </Suspense>
          </main>

          {/* Immersive Footer Bar */}
          <footer className="border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md py-4 text-xs font-mono text-slate-500 rounded-lg p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-2">
              <div className="flex items-center space-x-6 uppercase tracking-widest text-[10px]">
                <span className="text-cyan-400 font-bold">CYBERPUNK 2020 ENGINE</span>
                <span className="hover:text-slate-300">R. TALSORIAN GAMES</span>
                <span className="hover:text-slate-300">NETRUNNER AI LINK</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,1)]"></div>
                  <span className="text-emerald-500 text-[10px] font-bold uppercase">SUPABASE CLOUD CONECTADO</span>
                </div>
                <span className="border-l border-slate-800 pl-4 text-[10px]">v0.4.0-RELEASE</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
