import React, { useState, useEffect } from 'react';
import { CyberpunkMenu, TabType } from './components/CyberpunkMenu';
import { HomePage } from './components/HomePage';
import { PrdViewer } from './components/PrdViewer';
import { CharacterHeader } from './components/CharacterSheet/CharacterHeader';
import { StatBlock } from './components/CharacterSheet/StatBlock';
import { HealthTracker } from './components/CharacterSheet/HealthTracker';
import { CyberwareManager } from './components/CharacterSheet/CyberwareManager';
import { SkillsSection } from './components/CharacterSheet/SkillsSection';
import { WeaponsArmor } from './components/CharacterSheet/WeaponsArmor';
import { LifepathGenerator } from './components/CharacterSheet/LifepathGenerator';
import { DiceRoller } from './components/DiceRoller';
import { AiAssistant } from './components/AiAssistant';
import { PresetsManager } from './components/PresetsManager';
import { MultiplayerRoom } from './components/MultiplayerRoom';
import { UserProfile } from './components/UserProfile';
import { AuthModal } from './components/AuthModal';
import { CharacterSheet, RollResult, StatName } from './types/cyberpunk';
import { useCharacterSheet } from './hooks/useCharacterSheet';
import { useUserActivity } from './hooks/useUserActivity';
import { firebaseSignOut, auth } from './lib/firebase';
import { Dice5, Flame, AlertCircle, Save, CheckCircle2, Sparkles, Plus, Radio, Cpu, Lock } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [rollHistory, setRollHistory] = useState<RollResult[]>([]);
  const [lastRollBanner, setLastRollBanner] = useState<RollResult | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isSavingSheet, setIsSavingSheet] = useState(false);

  // Scalable custom hook for character state management & roster persistence
  const {
    user,
    authLoading,
    sheet,
    roster,
    updateSheet: handleUpdateSheet,
    loadSheet,
    loadPresetAsNewSheet,
    createNewCharacter,
    saveCurrentSheet,
    saveCurrentSheetAndReset,
    deleteCharacter,
    resetToBlankSheet
  } = useCharacterSheet();

  // Activity status tracking (online, inativo after 1min, em jogo when in multiplayer tab)
  const activityStatus = useUserActivity(user?.uid, activeTab === 'multiplayer');

  const handleSaveCurrentSheet = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsSavingSheet(true);
    try {
      const savedHandle = await saveCurrentSheet();
      setSaveToast(`Ficha de "${savedHandle}" foi atualizada e salva no seu perfil com sucesso!`);
      setTimeout(() => setSaveToast(null), 5000);
    } catch (e: any) {
      console.error('Error saving sheet:', e);
      setSaveToast(`Ficha salva localmente no navegador! Aviso da nuvem: ${e?.message || 'Erro de conexão'}`);
      setTimeout(() => setSaveToast(null), 5000);
    } finally {
      setIsSavingSheet(false);
    }
  };

  const handleSaveAndResetSheet = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsSavingSheet(true);
    try {
      const savedHandle = await saveCurrentSheetAndReset();
      setSaveToast(`Ficha de "${savedHandle}" salva! Formulário limpo e novo personagem em branco iniciado.`);
      setTimeout(() => setSaveToast(null), 5000);
    } catch (e: any) {
      console.error('Error saving sheet:', e);
      setSaveToast(`Ficha salva localmente no navegador! Aviso da nuvem: ${e?.message || 'Erro de conexão'}`);
      setTimeout(() => setSaveToast(null), 5000);
    } finally {
      setIsSavingSheet(false);
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
    setRollHistory(prev => [roll, ...prev]);
    setLastRollBanner(roll);
    // Broadcast roll to active multiplayer room if open
    window.dispatchEvent(new CustomEvent('cyberpunk_broadcast_roll', { detail: roll }));
    // Auto-hide banner after 4 seconds
    setTimeout(() => {
      setLastRollBanner(prev => (prev?.id === roll.id ? null : prev));
    }, 4000);
  };

  // Roll Skill directly from Skill section
  const handleRollSkill = (skillName: string, statName: StatName, statVal: number, skillRank: number) => {
    let baseD10 = Math.floor(Math.random() * 10) + 1;
    let isExploding = false;
    let isFumble = false;
    let extraRoll = 0;

    if (baseD10 === 10) {
      isExploding = true;
      extraRoll = Math.floor(Math.random() * 10) + 1;
    } else if (baseD10 === 1) {
      isFumble = true;
      extraRoll = Math.floor(Math.random() * 10) + 1;
    }

    const total = baseD10 + (isExploding ? extraRoll : 0) - (isFumble ? extraRoll : 0) + statVal + skillRank;

    let details = `Dado 1d10: ${baseD10}`;
    if (isExploding) details += ` + 🔥 Explosão (10!): +${extraRoll}`;
    if (isFumble) details += ` - 💀 Falha Crítica (1!): -${extraRoll}`;
    details += ` + ${statName} (${statVal}) + Perícia (${skillRank})`;

    const newRoll: RollResult = {
      id: 'roll_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      characterName: sheet.handle || 'Edgerunner',
      rollType: 'SKILL',
      label: `Rolagem: ${skillName}`,
      diceFormula: isExploding ? '1d10! (Explodiu!)' : isFumble ? '1d10! (Fumble!)' : '1d10',
      baseRoll: baseD10,
      bonus: statVal + skillRank,
      total,
      isCriticalSuccess: isExploding,
      isCriticalFailure: isFumble,
      details
    };

    handleAddRollResult(newRoll);
  };

  // Roll Weapon Attack directly
  const handleRollWeaponAttack = (weaponName: string, wa: number, damageStr: string) => {
    const refVal = sheet.stats.REF;
    handleRollSkill(`Ataque com ${weaponName}`, 'REF', refVal, wa);
  };

  // Roll Damage Only
  const handleRollDamageOnly = (weaponName: string, damageFormula: string) => {
    const match = damageFormula.trim().toLowerCase().match(/^(\d+)d(\d+)([\+\-]\d+)?$/);
    if (!match) return;

    const numDice = parseInt(match[1]) || 1;
    const dieSides = parseInt(match[2]) || 6;
    const modifier = match[3] ? parseInt(match[3]) : 0;

    let totalDmg = 0;
    const rolls: number[] = [];

    for (let i = 0; i < numDice; i++) {
      const r = Math.floor(Math.random() * dieSides) + 1;
      rolls.push(r);
      totalDmg += r;
    }
    totalDmg += modifier;

    const locRoll = Math.floor(Math.random() * 10) + 1;
    let locName = 'Tronco (2-4)';
    if (locRoll === 1) locName = 'Cabeça (1) [DANO DOBRADO X2!]';
    else if (locRoll === 5) locName = 'Braço Direito (5)';
    else if (locRoll === 6) locName = 'Braço Esquerdo (6)';
    else if (locRoll >= 7 && locRoll <= 8) locName = 'Perna Direita (7-8)';
    else if (locRoll >= 9) locName = 'Perna Esquerda (9-0)';

    const newRoll: RollResult = {
      id: 'roll_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      characterName: sheet.handle || 'Edgerunner',
      rollType: 'DAMAGE',
      label: `Dano da Arma: ${weaponName}`,
      diceFormula: damageFormula,
      baseRoll: totalDmg,
      bonus: 0,
      total: totalDmg,
      isCriticalSuccess: false,
      isCriticalFailure: false,
      details: `Dados: [${rolls.join(', ')}] • Local de Impacto: ${locName}`
    };

    handleAddRollResult(newRoll);
  };

  // Roll Death Save
  const handleRollDeathSave = () => {
    const d10 = Math.floor(Math.random() * 10) + 1;
    const targetBody = sheet.stats.BODY;
    const isSuccess = d10 <= targetBody;

    const newRoll: RollResult = {
      id: 'roll_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      characterName: sheet.handle || 'Edgerunner',
      rollType: 'SAVE',
      label: 'Teste de Atordoamento/Morte (Death Save)',
      diceFormula: '1d10 ≤ BODY',
      baseRoll: d10,
      bonus: targetBody,
      total: d10,
      isCriticalSuccess: isSuccess,
      isCriticalFailure: !isSuccess,
      details: isSuccess
        ? `PASSOU! Resultado ${d10} ≤ Corpo ${targetBody}`
        : `FALHOU! Resultado ${d10} > Corpo ${targetBody} (Personagem Inconsciente ou Morto!)`
    };

    handleAddRollResult(newRoll);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,_rgba(15,23,42,1)_0%,_rgba(2,6,23,1)_100%)] text-slate-200 font-sans selection:bg-cyan-500 selection:text-black relative">
      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
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
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          characterName={sheet.handle}
          characterRole={sheet.role}
          user={user}
          activityStatus={activityStatus}
          onOpenAuth={() => setIsAuthModalOpen(true)}
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
            {/* TAB 0: HOME / INÍCIO OVERVIEW */}
            {activeTab === 'home' && <HomePage onNavigate={(tab) => setActiveTab(tab)} />}

            {/* TAB 1: PRD DOCUMENTATION & ARCHITECTURE */}
            {activeTab === 'prd' && <PrdViewer />}

            {/* TAB 2: CHARACTER SHEET GENERATOR */}
            {activeTab === 'sheet' && (
              <div className="space-y-6">
                {/* Header / Identity */}
                <CharacterHeader sheet={sheet} onChange={handleUpdateSheet} />

                {/* Health & Wound Tracker */}
                <HealthTracker
                  sheet={sheet}
                  onChange={handleUpdateSheet}
                  onRollDeathSave={handleRollDeathSave}
                />

                {/* Primary & Derived Stats */}
                <StatBlock sheet={sheet} onChange={handleUpdateSheet} />

                {/* Cyberware & Humanity */}
                <CyberwareManager sheet={sheet} onChange={handleUpdateSheet} />

                {/* Weapons & Armor SP */}
                <WeaponsArmor
                  sheet={sheet}
                  onChange={handleUpdateSheet}
                  onRollWeaponAttack={handleRollWeaponAttack}
                  onRollDamageOnly={handleRollDamageOnly}
                />

                {/* Skills Tree */}
                <SkillsSection
                  sheet={sheet}
                  onChange={handleUpdateSheet}
                  onRollSkill={handleRollSkill}
                />

                {/* Lifepath Narrative */}
                <LifepathGenerator sheet={sheet} onChange={handleUpdateSheet} />

                {/* BOTTOM ACTION BAR: SAVE SHEET & OPTIONS */}
                <div className="bg-slate-950 border-2 border-cyan-500/60 rounded-xl p-6 shadow-[0_0_25px_rgba(6,182,212,0.2)] flex flex-col lg:flex-row items-center justify-between gap-6 font-mono">
                  <div className="space-y-1.5 text-center lg:text-left">
                    <div className="flex items-center justify-center lg:justify-start space-x-2">
                      <Save className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-base font-bold text-cyan-400 uppercase tracking-wider">
                        Gerenciamento da Ficha // {user ? (sheet.handle || 'Edgerunner') : 'Modo Visitante'}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300 max-w-xl">
                      {user ? (
                        <>Edição em andamento da ficha de <strong className="text-yellow-400">{sheet.handle || 'Edgerunner'}</strong> ({sheet.role}). Sincronizada com seu perfil na nuvem.</>
                      ) : (
                        <>Você está visualizando o criador de ficha no <strong>Modo Visitante</strong>. Crie uma conta ou faça login para salvar permanentemente suas fichas na nuvem.</>
                      )}
                    </p>
                    <div className="text-[10px] text-slate-500 font-mono">
                      ID: <span className="text-cyan-500">{sheet.id}</span> • Status: <span className="text-emerald-400 font-bold">{user ? 'Auto-Sincronização Ativa' : 'Modo Visitante'}</span>
                    </div>
                  </div>

                  {user ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                      {/* Main Update/Save Button */}
                      <button
                        onClick={handleSaveCurrentSheet}
                        disabled={isSavingSheet}
                        className="w-full sm:w-auto px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs uppercase rounded tracking-wider shadow-[0_0_18px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-black" />
                        <span>{isSavingSheet ? 'Salvando...' : 'Salvar Alterações da Ficha'}</span>
                      </button>

                      {/* Optional Save & Reset for New Character */}
                      <button
                        onClick={handleSaveAndResetSheet}
                        disabled={isSavingSheet}
                        className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-yellow-400 font-bold text-xs uppercase rounded transition-all flex items-center justify-center space-x-2 cursor-pointer"
                        title="Salva a ficha atual e inicia uma nova ficha em branco"
                      >
                        <Plus className="w-4 h-4 text-yellow-400" />
                        <span>Nova Ficha em Branco</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-yellow-950/60 border border-yellow-500/60 p-3.5 rounded-lg text-xs font-mono text-yellow-300 flex items-center space-x-3">
                      <Lock className="w-5 h-5 text-yellow-400 shrink-0" />
                      <div>
                        <span className="font-bold block uppercase text-yellow-400">Modo Visitante</span>
                        <span className="text-slate-300">Acesse sua conta para salvar suas fichas permanentemente na nuvem.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: DICE ROLLER & COMBAT LOG */}
            {activeTab === 'dice' && (
              <DiceRoller
                sheet={sheet}
                rollHistory={rollHistory}
                onAddRoll={handleAddRollResult}
                onClearHistory={() => setRollHistory([])}
              />
            )}

            {/* TAB 4: NETRUNNER AI ASSISTANT */}
            {activeTab === 'ai' && (
              <AiAssistant
                sheet={sheet}
                onChange={handleUpdateSheet}
                user={user}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
              />
            )}

            {/* TAB 5: MULTIPLAYER VIRTUAL TABLE */}
            {activeTab === 'multiplayer' && (
              <MultiplayerRoom
                sheet={sheet}
                onUpdateSheet={handleUpdateSheet}
                onRollDice={handleAddRollResult}
                user={user}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
              />
            )}

            {/* TAB 6: PRESET CHARACTERS & IMPORT/EXPORT */}
            {activeTab === 'presets' && (
              <PresetsManager
                currentSheet={sheet}
                onLoadSheet={loadSheet}
                onLoadPresetAsNewSheet={loadPresetAsNewSheet}
                onCreateNew={createNewCharacter}
                roster={roster}
                onDeleteSheet={deleteCharacter}
                user={user}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
              />
            )}

            {/* TAB 7: USER PROFILE */}
            {activeTab === 'profile' && (
              <UserProfile
                user={user}
                authLoading={authLoading}
                activityStatus={activityStatus}
                roster={roster}
                activeSheetId={sheet.id}
                onLoadSheet={loadSheet}
                onDeleteSheet={deleteCharacter}
                onCreateNewSheet={createNewCharacter}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onNavigateToSheetCreator={() => setActiveTab('sheet')}
                onLogout={handleLogout}
              />
            )}
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
                  <span className="text-emerald-500 text-[10px] font-bold uppercase">FIREBASE CLOUD CONECTADO</span>
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
