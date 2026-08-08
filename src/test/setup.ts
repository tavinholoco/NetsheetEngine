// Fase 9 (T9.1) — setup global do Vitest: matchers estendidos do
// jest-dom (toBeInTheDocument, toHaveTextContent, etc.) para os asserts
// dos testes de componente + cleanup do DOM entre os testes.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
