/**
 * Fase 9 (T9.1) — SMOKE TEST da infraestrutura de testes.
 * Prova que o pipeline funciona de ponta a ponta: Vitest + jsdom +
 * React Testing Library + jest-dom + user-event + React Router.
 * Testes reais de regras/estatísticas vêm na T9.2.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { NotFoundPage } from '../pages/NotFoundPage';

describe('Infra de testes (Vitest + RTL + jsdom)', () => {
  it('renderiza o Button shadcn com texto e variante cyber', () => {
    render(<Button variant="cyber">ENTRAR NA NET</Button>);
    const btn = screen.getByRole('button', { name: 'ENTRAR NA NET' });
    expect(btn).toBeInTheDocument();
    // jest-dom + variantes do cva aplicadas ao className
    expect(btn.className).toContain('bg-yellow-400');
  });

  it('renderiza a página 404 dentro do Router', () => {
    render(
      <MemoryRouter initialEntries={['/nao-existe']}>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(screen.getByText('// ROTA NÃO ENCONTRADA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voltar ao início/i })).toBeInTheDocument();
  });

  it('navega de volta ao início com user-event (Router integrado)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/nao-existe']}>
        <Routes>
          <Route path="/" element={<div>HOME TESTE</div>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Antes: a rota desconhecida mostra o 404
    expect(screen.getByText('// ROTA NÃO ENCONTRADA')).toBeInTheDocument();

    // Clique real no botão do 404 → navigate('/')
    await user.click(screen.getByRole('button', { name: /voltar ao início/i }));

    // Depois: a rota "/" renderiza o conteúdo da home de teste
    expect(screen.getByText('HOME TESTE')).toBeInTheDocument();
    expect(screen.queryByText('// ROTA NÃO ENCONTRADA')).not.toBeInTheDocument();
  });
});
