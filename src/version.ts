/**
 * A versão que a interface mostra — a do `package.json`, a mesma que o
 * `/api/health` publica (T10.4). Andam juntas com a tag (R.9).
 *
 * Até 29/09/2026 a interface tinha "v0.4.0" escrito à mão em seis lugares, e
 * mostrava 0.4.0 com o projeto em 0.4.3. Um lugar só, lido do pacote, não
 * envelhece sozinho.
 */
import { version } from '../package.json';

export const APP_VERSION = `v${version}`;
