import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'out/**',
      'tests/**',
      'vitest.config.ts',
      'eslint.config.js',
    ],
  },
  {
    rules: {
      // Mirrors chronova SG rules (sg/rules/) enforced on the main repo
      '@typescript-eslint/no-explicit-any': 'error', // no-as-any
      '@typescript-eslint/ban-ts-comment': 'error', // no-ts-ignore
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], // allow intentionally unused args/vars prefixed with _
      'no-empty': ['error', { allowEmptyCatch: false }], // no-empty-catch
      'no-console': ['error', { allow: ['error', 'warn'] }], // no-console-log (SG rule targets console.log specifically; error/warn to stderr are legitimate)
    },
  },
  {
    files: ['tests/**'],
    rules: {
      'no-console': 'off',
    },
  },
);