// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([globalIgnores(['dist']), {
  files: ['**/*.{ts,tsx}'],
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    globals: globals.browser,
  },
  rules: {
    'no-restricted-properties': [
      'error',
      {
        object: 'Math',
        property: 'random',
        message: 'Use RNG parameter; Math.random is forbidden. See CONTEXT.md §1.',
      },
    ],
  },
}, {
  // Dispatch chokepoint: useRunStore/useCombatStore/useMetaStore .setState
  // must only be called inside src/state/** (where the reducers live).
  // useCombatUiStore is intentionally excluded — it's UI-chrome-only and
  // documented as "Phaser writes; React HUD reads" (CONTEXT.md §8).
  // getState() is allowed everywhere (read-only POJO access).
  files: ['src/**/*.{ts,tsx}'],
  ignores: [
    'src/state/**',
    'src/storybook/**',
    '**/*.stories.tsx',
    'src/tests/**',
    '**/*.test.{ts,tsx}',
  ],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "MemberExpression[object.name=/^use(Run|Combat|Meta)Store$/][property.name='setState']",
        message: 'Store mutations must go through dispatch(action). Bypassing the dispatch chokepoint breaks the action log, save/replay determinism, and reducer invariants. See CONTEXT.md §1 invariant #2.',
      },
    ],
  },
}, {
  // src/ui/** (React DOM layer): no Phaser imports; route UI primitives
  // through src/ui/components/ wrappers, not raw react-aria.
  files: ['src/ui/**/*.{ts,tsx}'],
  ignores: ['src/ui/components/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-aria-components',
            message: 'Import from src/ui/components/ instead of raw react-aria-components.',
          },
          {
            name: 'react-aria',
            message: 'Import from src/ui/components/ instead of raw react-aria.',
          },
          {
            name: 'phaser',
            message: 'src/ui/ is the React DOM layer; canvas concerns belong in src/game/. See CONTEXT.md §1 invariant #1.',
          },
        ],
      },
    ],
  },
}, {
  // src/game/** (Phaser canvas layer): no React imports. Render UI in
  // src/ui/ DOM via CombatHud overlay; canvas owns board things only.
  files: ['src/game/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react',
            message: 'src/game/ is the Phaser canvas layer; render UI in src/ui/ (React DOM) instead. See CONTEXT.md §1 invariant #1.',
          },
          {
            name: 'react-dom',
            message: 'src/game/ is the Phaser canvas layer; render UI in src/ui/ (React DOM) instead. See CONTEXT.md §1 invariant #1.',
          },
        ],
        patterns: [
          {
            group: ['react/*', 'react-dom/*'],
            message: 'src/game/ must not import React or react-dom. UI lives in src/ui/.',
          },
        ],
      },
    ],
  },
}, {
  // src/systems/** and src/procgen/** are pure functions: no framework
  // imports. State in, state' out. See CONTEXT.md §1 invariant #3.
  files: ['src/systems/**/*.{ts,tsx}', 'src/procgen/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'phaser',
            message: 'src/systems/ and src/procgen/ are pure functions — no framework imports.',
          },
          {
            name: 'react',
            message: 'src/systems/ and src/procgen/ are pure functions — no framework imports.',
          },
          {
            name: 'react-dom',
            message: 'src/systems/ and src/procgen/ are pure functions — no framework imports.',
          },
        ],
        patterns: [
          {
            group: ['react/*', 'react-dom/*', 'phaser/*'],
            message: 'Pure systems must not import framework code.',
          },
        ],
      },
    ],
  },
}, ...storybook.configs["flat/recommended"]])
