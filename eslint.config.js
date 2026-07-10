import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    // Standalone relay operator/diagnostic tools + their test harness are run
    // via `tsx`/node --test and are intentionally decoupled from the app's
    // lint/typecheck (see tsconfig.json exclude).
    ignores: [
      'external/**',
      '.yarn/**',
      'dist/**',
      'node_modules/**',
      'scripts/relay-*.ts',
      'tests-relay/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tsPlugin },
    languageOptions: { parser: tsParser },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      'react/no-unescaped-entities': 0,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
