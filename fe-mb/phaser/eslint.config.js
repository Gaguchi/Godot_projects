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
  // Forbid raw react-aria(-components) imports outside the wrapper layer.
  // All UI code MUST go through src/ui/components/ for consistent state
  // styling, accessibility, and bundle hygiene.
  files: ['src/**/*.{ts,tsx}'],
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
        ],
      },
    ],
  },
}, ...storybook.configs["flat/recommended"]])
