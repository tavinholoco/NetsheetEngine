/**
 * L.3d — as rotas e as páginas com lazy loading, fora do `App`.
 *
 * Cada módulo vira um chunk separado no bundle; o `Suspense` mostra o fallback
 * enquanto o chunk carrega (T7.1). O bloco saiu do `App` inteiro, com as
 * mesmas props — a diferença é que a aba e o modal de login agora vêm da store
 * aqui dentro, e não por prop.
 */
import React, { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import type { ActivityStatus } from '../hooks/useUserActivity';
import type { UseCharacterSheetResult } from '../hooks/useCharacterSheet';
import type { SheetRollHandlers } from '../hooks/useSheetRollHandlers';
import type { CharacterSheet } from '../types/cyberpunk';
import type { User } from '../lib/supabase';
import { useUiStore } from '../stores/useUiStore';
import { useRollStore } from '../stores/useRollStore';

// ===========================================================================
// FASE 7 (T7.1) — PÁGINAS COM LAZY LOADING (code-splitting por rota)
// ===========================================================================
const HomePageLazy = lazy(() => import('./HomePage').then((m) => ({ default: m.HomePage })));
const PrdViewerLazy = lazy(() => import('./PrdViewer').then((m) => ({ default: m.PrdViewer })));
const SheetPageLazy = lazy(() => import('../pages/SheetPage').then((m) => ({ default: m.SheetPage })));
const DiceRollerLazy = lazy(() => import('../features/sheet/DiceRoller').then((m) => ({ default: m.DiceRoller })));
const AiAssistantLazy = lazy(() => import('../features/ai/AiAssistant').then((m) => ({ default: m.AiAssistant })));
const RoomPageLazy = lazy(() => import('../pages/RoomPage').then((m) => ({ default: m.RoomPage })));
const PresetsManagerLazy = lazy(() => import('./PresetsManager').then((m) => ({ default: m.PresetsManager })));
const UserProfileLazy = lazy(() => import('../features/social/UserProfile').then((m) => ({ default: m.UserProfile })));
const NotFoundLazy = lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

/** Placeholder exibido enquanto o chunk da rota carrega. */
const RouteFallback: React.FC = () => (
  <div className="flex items-center justify-center py-20 font-mono text-subtle animate-pulse">
    <span className="text-xs uppercase tracking-caps">Carregando módulo da Net...</span>
  </div>
);

export interface AppRoutesProps {
  /** O retorno do `useCharacterSheet` — as ações que as páginas chamam. */
  sheetResult: UseCharacterSheetResult;
  /** A ficha ativa como a store a espelha (é dela que a tela lê). */
  sheet: CharacterSheet;
  user: User | null;
  isSavingSheet: boolean;
  activityStatus: ActivityStatus;
  onSave: () => void;
  onSaveAndReset: () => void;
  onLogout: () => void;
  rolls: SheetRollHandlers;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
  sheetResult,
  sheet,
  user,
  isSavingSheet,
  activityStatus,
  onSave,
  onSaveAndReset,
  onLogout,
  rolls
}) => {
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const {
    updateSheet: handleUpdateSheet,
    loadSheet,
    loadPresetAsNewSheet,
    createNewCharacter,
    deleteCharacter
  } = sheetResult;

  return (
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
              onRollDeathSave={rolls.rollDeathSave}
              onRollStunSave={rolls.rollStunSave}
              onRollWeaponAttack={rolls.rollWeaponAttack}
              onRollDamageOnly={rolls.rollDamageOnly}
              onRollSkill={rolls.rollSkill}
              onRollCheck={rolls.rollCheck}
              user={user}
              isSavingSheet={isSavingSheet}
              onSave={onSave}
              onSaveAndReset={onSaveAndReset}
            />
          }
        />
        <Route
          path="/dice"
          element={
            <DiceRollerLazy
              onAddRoll={rolls.addRollResult}
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
        {/* H.03 — o lobby também é o RoomPage: a mesa que fica ativa ali leva a URL para /room/CÓDIGO */}
        <Route
          path="/multiplayer"
          element={<RoomPageLazy onOpenAuthModal={() => useUiStore.getState().openAuthModal()} />}
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
              onLogout={onLogout}
            />
          }
        />
        <Route path="*" element={<NotFoundLazy />} />
      </Routes>
    </Suspense>
  );
};
