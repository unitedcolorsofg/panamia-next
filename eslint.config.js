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
      '.next/**',
      'dist/**',
      'node_modules/**',
      'scripts/relay-*.ts',
      'tests-relay/**',

      // The native projects are generated — scaffolded by `cap add`, then
      // rewritten by `cap sync` and the Gradle/Xcode builds. Nothing in them
      // is authored here (they hold no tracked JS or TS at all; the only
      // hand-written file under mobile/ is www/offline.html, which stays
      // lintable). Left in, a local Android build fails `yarn lint` on
      // Capacitor's own bundled native-bridge.js, which carries
      // eslint-disable comments for rules this config does not define.
      'mobile/android/**',
      'mobile/ios/**',
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
