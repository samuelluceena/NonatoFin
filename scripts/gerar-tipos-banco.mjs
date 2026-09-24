#!/usr/bin/env node
/**
 * Gera src/lib/supabase/database.types.ts a partir do banco, usando o
 * gerador oficial do Supabase.
 *
 *   npm run db:tipos          # banco local do `npx supabase start` (Docker)
 *   npm run db:tipos:nuvem    # projeto na nuvem (após `npx supabase link`)
 *
 * Depois de gerar, rode `npm run typecheck`: onde o código não combinar mais
 * com o banco, o TypeScript aponta.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const DESTINO = 'src/lib/supabase/database.types.ts';
const origem = process.argv.includes('--nuvem') ? '--linked' : '--local';

const CABECALHO = `/**
 * ARQUIVO GERADO AUTOMATICAMENTE a partir do banco — NÃO EDITE À MÃO.
 * Para atualizar depois de mudar uma migration: \`npm run db:tipos\`
 * (veja docs/MANUTENCAO.md). O teste tests/integracao/tipos-banco.test.ts
 * acusa quando este arquivo e o banco divergem.
 * Tipos auxiliares do app ficam em ./tipos-banco.ts.
 */
`;

try {
  const tipos = execFileSync('npx', ['supabase', 'gen', 'types', 'typescript', origem, '--schema', 'public'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  writeFileSync(DESTINO, CABECALHO + tipos);
  console.log(`Tipos gerados em ${DESTINO} (origem: ${origem === '--linked' ? 'nuvem' : 'local'}).`);
} catch {
  console.error(
    '\nNão foi possível gerar os tipos. Confira se o banco está no ar (`npx supabase start`)' +
      ' ou se o projeto está ligado (`npx supabase link`). Veja docs/MANUTENCAO.md.',
  );
  process.exit(1);
}
