/**
 * Fase 7 (T7.1) — MAPAS DE ROTA ↔ ABA DO MENU
 * A aba ativa (useUiStore.activeTab) e a URL andam juntas:
 *  - clicar no menu → muda a aba → `tabToPath` navega
 *  - navegar (URL) → `pathToTab` sincroniza a aba (destaque do menu)
 * Rotas: /, /sheet, /dice, /ai, /multiplayer, /presets, /profile, /prd, /room/:code
 */
import type { TabType } from './components/CyberpunkMenu';

/** Caminho exato de cada aba do menu (sem /room/:code — é deep link). */
export const ROUTE_PATHS: Record<TabType, string> = {
  home: '/',
  sheet: '/sheet',
  dice: '/dice',
  ai: '/ai',
  multiplayer: '/multiplayer',
  presets: '/presets',
  profile: '/profile',
  prd: '/prd'
};

/** Caminho da URL para a aba correspondente (null se não é rota conhecida). */
export function pathToTab(pathname: string): TabType | null {
  if (pathname.startsWith('/room/')) return 'multiplayer';
  const entry = Object.entries(ROUTE_PATHS).find(([, path]) => path === pathname);
  return entry ? (entry[0] as TabType) : null;
}

/** Aba para o caminho (null se a aba não tem rota própria). */
export function tabToPath(tab: TabType): string | null {
  return ROUTE_PATHS[tab] ?? null;
}
