import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Regras de dependência entre camadas (veja docs/ARQUITETURA.md).
 * O lint falha se alguém quebrar a arquitetura sem querer.
 */
const camadas = [
  {
    // Regras de negócio: funções puras, testáveis sem banco nem tela.
    files: ["src/lib/domain/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["react", "react-dom", "next", "next/*", "@supabase/*", "server-only"], message: "lib/domain deve ser puro (sem React, Next ou Supabase)." },
          { group: ["@/features/*", "@/app/*", "@/components/*", "@/lib/supabase/*", "@/lib/auth/*", "@/lib/acoes/*"], message: "lib/domain só pode usar lib/domain e lib/config." },
        ],
      }],
    },
  },
  {
    // Infraestrutura compartilhada: não conhece funcionalidades nem telas.
    files: ["src/lib/**"],
    ignores: ["src/lib/domain/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/features/*", "@/app/*", "@/components/*"], message: "lib não pode depender de features, app ou components." }],
      }],
    },
  },
  {
    // Design system: componentes visuais genéricos, sem regra de negócio.
    files: ["src/components/ui/**", "src/components/graficos/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/features/*", "@/app/*", "@/lib/supabase/*", "@/lib/auth/*"], message: "Componentes de UI não acessam dados nem funcionalidades." }],
      }],
    },
  },
  {
    // Telas e componentes nunca falam direto com o banco: usam features/*/consultas e acoes.
    files: ["src/app/**", "src/components/**"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.property.name=/^(from|rpc)$/][callee.object.name=/supabase/i]",
        message: "Acesso ao banco só em features/*/consultas.ts ou acoes.ts.",
      }],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...camadas,
  { rules: { "import/no-duplicates": "error" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefatos gerados (relatórios e rastros de testes, banco local).
    "test-results/**",
    "playwright-report/**",
    "coverage/**",
    ".local-stack/**",
  ]),
]);

export default eslintConfig;
