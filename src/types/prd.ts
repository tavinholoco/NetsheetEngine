/**
 * ============================================================
 * NETSHEET ENGINE — TIPOS DO PRD (Product Requirements Document)
 * Modela o documento de especificação do produto exibido pelo
 * PrdViewer: seções de visão, módulos, fases do roadmap e a
 * arquitetura técnica. Alinhado ao PLANO_DE_ACAO.md (documento
 * mestre de acompanhamento do projeto).
 * ============================================================
 */

/** Status de uma fase, tarefa, módulo ou seção do PRD. */
export type PrdStatus = 'concluído' | 'em andamento' | 'pendente' | 'planejado';

/** Prioridade de fase (legenda do plano de ação). */
export type PrdPriority = 'P0' | 'P1' | 'P2' | 'P3';

/** Tarefa individual de uma fase do roadmap. */
export interface PrdTask {
  /** Código da tarefa, ex.: "T0.7". */
  code: string;
  title: string;
  status: PrdStatus;
}

/** Fase do roadmap de evolução do produto. */
export interface PrdPhase {
  id: string;
  /** Número da fase, ex.: 0..12. */
  number: number;
  title: string;
  objective: string;
  priority: PrdPriority;
  status: PrdStatus;
  tasks: PrdTask[];
}

/** Módulo funcional do produto. */
export interface PrdModule {
  id: string;
  name: string;
  description: string;
  features: string[];
  status: PrdStatus;
}

/** Camada da arquitetura técnica. */
export interface PrdArchitectureItem {
  id: string;
  /** Camada, ex.: Frontend, Backend, Dados, Realtime, IA. */
  layer: string;
  description: string;
  tech: string[];
}

/** Seção textual do PRD (visão, personas, regras, métricas...). */
export interface PrdSection {
  id: string;
  title: string;
  content: string;
  /** Lista opcional de tópicos/regras associadas à seção. */
  items?: string[];
}

/** Documento PRD completo consumido pelo PrdViewer. */
export interface PrdDocument {
  id: string;
  title: string;
  subtitle: string;
  version: string;
  updatedAt: string;
  /** Seções de visão/escopo do documento. */
  overview: PrdSection[];
  modules: PrdModule[];
  /** Roadmap de fases de evolução. */
  roadmap: PrdPhase[];
  architecture: PrdArchitectureItem[];
}
