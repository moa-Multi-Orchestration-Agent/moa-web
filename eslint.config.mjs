import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import boundaries from 'eslint-plugin-boundaries';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// 의존 방향: app → features → entities → shared (design.md 3.4.1)
const layers = {
  plugins: { boundaries },
  settings: {
    'import/resolver': { typescript: { alwaysTryTypes: true } },
    'boundaries/include': ['src/**/*'],
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/**/*', partialMatch: false },
      { type: 'features', pattern: 'src/features/*', capture: ['feature'] },
      { type: 'entities', pattern: 'src/entities/*', capture: ['entity'] },
      { type: 'shared', pattern: 'src/shared/**/*', partialMatch: false },
      { type: 'mocks', pattern: 'src/mocks/**/*', partialMatch: false },
      { type: 'test', pattern: 'src/test/**/*', partialMatch: false },
    ],
  },
  rules: {
    'boundaries/dependencies': [
      2,
      {
        default: 'disallow',
        policies: [
          { from: { element: { type: 'app' } }, allow: { to: { element: { types: { anyOf: ['app', 'features', 'entities', 'shared', 'mocks'] } } } } },
          { from: { element: { type: 'features' } }, allow: { to: { element: { types: { anyOf: ['entities', 'shared'] } } } } },
          { from: { element: { type: 'entities' } }, allow: { to: { element: { types: { anyOf: ['entities', 'shared'] } } } } },
          { from: { element: { type: 'shared' } }, allow: { to: { element: { type: 'shared' } } } },
          { from: { element: { type: 'mocks' } }, allow: { to: { element: { types: { anyOf: ['mocks', 'entities', 'shared'] } } } } },
          { from: { element: { type: 'test' } }, allow: { to: { element: { types: { anyOf: ['test', 'mocks', 'entities', 'shared', 'features'] } } } } },
        ],
      },
    ],
  },
};

const config = [
  { ignores: ['commitlint.config.mjs', '.next/**', '.next-*/**', 'node_modules/**', 'public/mockServiceWorker.js', 'playwright-report/**', 'test-results/**', 'next-env.d.ts', 'docs/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  layers,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-globals': ['error', { name: 'localStorage', message: '목 데이터는 메모리에만 둔다(localStorage 금지).' }],
    },
  },
  {
    // 테스트는 목 서버·픽스처를 직접 쓴다
    files: ['src/**/*.test.{ts,tsx}'],
    rules: { 'boundaries/dependencies': 'off' },
  },
];

export default config;
