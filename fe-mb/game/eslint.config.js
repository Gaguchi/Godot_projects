import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'electron'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Determinism: every random draw goes through the seeded RNG so saves
      // replay and tests are stable.
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use the seeded rng (src/engine/rng.ts).' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Rules engine stays framework-free: no React, no DOM.
    files: ['src/engine/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', '**/ui/**'] }],
      'no-restricted-globals': ['error', 'document', 'window', 'localStorage'],
    },
  },
)
