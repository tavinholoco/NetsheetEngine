import React, { useState } from 'react';
import { PRD_DOCUMENT } from '../data/prdData';
import type { PrdStatus, PrdTask } from '../types/prd';
import { FileText, Layers, Rocket, Cpu, CheckCircle2, Loader2, Terminal } from 'lucide-react';

const STATUS_STYLE: Record<PrdStatus, { label: string; cls: string }> = {
  'concluído': { label: 'CONCLUÍDO', cls: 'bg-ok-950/80 text-ok-400 border-ok-500/60' },
  'em andamento': { label: 'EM ANDAMENTO', cls: 'bg-accent-950/80 text-accent-400 border-accent-500/60' },
  'pendente': { label: 'PENDENTE', cls: 'bg-raised text-muted border-line-strong' },
  'planejado': { label: 'PLANEJADO', cls: 'bg-cyber-950/80 text-cyber-400 border-cyber-500/60' },
  'cancelado': { label: 'CANCELADO', cls: 'bg-fault-950/80 text-fault-400 border-fault-500/60' }
};

const PRIORITY_STYLE: Record<string, string> = {
  P0: 'bg-fault-950/80 text-fault-400 border-fault-500/60',
  P1: 'bg-caution-950/80 text-caution-400 border-caution-500/60',
  P2: 'bg-accent-950/80 text-accent-400 border-accent-500/60',
  P3: 'bg-raised text-muted border-line-strong'
};

function StatusBadge({ status }: { status: PrdStatus }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE['pendente'];
  return (
    <span className={`text-micro px-1.5 py-0.5 border rounded font-black uppercase tracking-caps ${s.cls}`}>
      {s.label}
    </span>
  );
}

export const PrdViewer: React.FC = () => {
  const doc = PRD_DOCUMENT;
  const [activeSection, setActiveSection] = useState<'overview' | 'modules' | 'roadmap' | 'architecture'>('overview');
  const totalTasks = doc.roadmap.reduce((acc, p) => acc + p.tasks.filter((t: PrdTask) => t.status !== 'cancelado').length, 0);
  const doneTasks = doc.roadmap.reduce((acc, p) => acc + p.tasks.filter((t: PrdTask) => t.status === 'concluído').length, 0);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="bg-surface/90 border-2 border-night-500/40 rounded-2xl p-6 relative overflow-hidden shadow-glow-25 shadow-night-400/10">
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-signal-500 to-accent-500" />
        <div className="pl-3 relative z-10">
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="w-5 h-5 text-fg-strong" />
            <span className="text-mini font-black tracking-caps text-fg-strong uppercase">PRD // NETSHEET ENGINE</span>
            <StatusBadge status="em andamento" />
          </div>
          <h1 className="font-display text-2xl font-black italic text-signal-400 uppercase drop-shadow-glow-15 drop-shadow-signal-400/40">
            {doc.title}
          </h1>
          <p className="text-xs text-fg-soft mt-1 max-w-3xl leading-relaxed">{doc.subtitle}</p>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-micro text-subtle">
            <span>Versão: <strong className="text-accent-400">{doc.version}</strong></span>
            <span>Atualizado: <strong className="text-fg-soft">{doc.updatedAt}</strong></span>
            <span>Tarefas: <strong className="text-signal-400">{doneTasks}/{totalTasks}</strong> concluídas</span>
          </div>
          <div className="mt-3 h-1.5 bg-raised rounded-full overflow-hidden border border-line">
            <div
              className="h-full bg-gradient-to-r from-accent-500 to-ok-500 transition-all duration-700 shadow-glow-10 shadow-accent-500/60"
              style={{ width: `${totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Navegação */}
      <div className="flex flex-wrap gap-1.5">
        {([
          { id: 'overview' as const, label: '📋 Visão', icon: FileText },
          { id: 'modules' as const, label: '🧩 Módulos', icon: Cpu },
          { id: 'roadmap' as const, label: '🚀 Roadmap', icon: Rocket },
          { id: 'architecture' as const, label: '🏗️ Arquitetura', icon: Layers }
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`px-3 py-1.5 rounded-lg border text-mini font-black uppercase tracking-caps flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeSection === id
                ? 'bg-signal-950/80 border-signal-400 text-signal-300 shadow-glow-12 shadow-signal-400/40'
                : 'bg-surface border-line text-muted hover:border-accent-500/50 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {doc.overview.map((section) => (
            <div key={section.id} className="bg-surface/80 border-l-4 border-l-accent-500 border-y border-r border-line rounded-xl p-5">
              <h3 className="text-sm font-black text-accent-400 uppercase tracking-caps mb-2">{section.title}</h3>
              <p className="text-xs text-fg-soft leading-relaxed">{section.content}</p>
              {section.items && (
                <ul className="mt-3 space-y-1.5">
                  {section.items.map((item, i) => (
                    <li key={i} className="text-mini text-muted flex items-start space-x-2">
                      <span className="text-accent-500 font-black shrink-0">▸</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {activeSection === 'modules' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {doc.modules.map((mod) => (
            <div key={mod.id} className="bg-surface/80 border-l-4 border-l-signal-500 border-y border-r border-line rounded-xl p-5 hover:shadow-glow-15 hover:shadow-signal-500/12 transition-all">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black text-signal-400 uppercase tracking-caps">{mod.name}</h3>
                <StatusBadge status={mod.status} />
              </div>
              <p className="text-mini text-muted leading-relaxed mb-3">{mod.description}</p>
              <ul className="space-y-1">
                {mod.features.map((f, i) => (
                  <li key={i} className="text-micro text-fg-soft flex items-start space-x-1.5">
                    <CheckCircle2 className="w-3 h-3 text-ok-400 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {activeSection === 'roadmap' && (
        <div className="space-y-4">
          {doc.roadmap.map((phase) => {
            const applicable = phase.tasks.filter((t) => t.status !== 'cancelado').length;
            const done = phase.tasks.filter((t) => t.status === 'concluído').length;
            const pct = applicable ? Math.round((done / applicable) * 100) : 0;
            return (
              <div key={phase.id} className="bg-surface/80 border-l-4 border-l-night-400 border-y border-r border-line rounded-xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`text-micro px-1.5 py-0.5 border rounded ${PRIORITY_STYLE[phase.priority]} font-mono`}>
                      {phase.priority}
                    </span>
                    <h3 className="text-sm font-black text-white uppercase tracking-caps">
                      Fase {phase.number} — {phase.title}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <StatusBadge status={phase.status} />
                    <span className="text-micro text-subtle font-mono">{done}/{applicable}</span>
                  </div>
                </div>
                <p className="text-mini text-muted mb-3">{phase.objective}</p>
                <div className="h-1 bg-raised rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-gradient-to-r from-accent-500 to-signal-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {phase.tasks.map((task) => (
                    <div key={task.code} className="flex items-center space-x-2 text-micro font-mono">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        task.status === 'concluído' ? 'bg-ok-400' : task.status === 'em andamento' ? 'bg-accent-400 animate-pulse' : task.status === 'cancelado' ? 'bg-fault-500' : 'bg-night-700'
                      }`} />
                      <span className="text-subtle font-bold shrink-0">{task.code}</span>
                      <span className={`truncate ${task.status === 'concluído' ? 'text-subtle line-through' : 'text-fg-soft'}`}>
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeSection === 'architecture' && (
        <div className="space-y-4">
          {doc.architecture.map((layer, idx) => (
            <div key={layer.id} className={`bg-surface/80 border-2 rounded-xl p-5 ${
              idx === 0 ? 'border-accent-500/40' : idx === doc.architecture.length - 1 ? 'border-cyber-500/40' : 'border-line-strong/60'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                <Terminal className="w-4 h-4 text-accent-400" />
                <h3 className="text-sm font-black text-accent-400 uppercase tracking-caps">{layer.layer}</h3>
              </div>
              <p className="text-mini text-muted leading-relaxed mb-3">{layer.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {layer.tech.map((t) => (
                  <span key={t} className="text-micro px-2 py-0.5 rounded bg-raised border border-line-strong text-signal-300 font-mono">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
