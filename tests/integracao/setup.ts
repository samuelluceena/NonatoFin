import { config } from 'dotenv';

// Testes de integração usam o Supabase LOCAL (veja .env.test e docs/TESTES.md).
config({ path: '.env.test', quiet: true });
