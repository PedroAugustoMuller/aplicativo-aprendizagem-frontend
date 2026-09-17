import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
  // .dependency-cruiser.cjs is CommonJS tooling config (module.exports), not
  // app source - linting it under the ESM-oriented rule set below would flag
  // `module` as an undefined global for no benefit.
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'e2e/.auth',
      'node_modules',
      '.dependency-cruiser.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  // Node-executed tooling scripts (run via `node scripts/*.mjs`, never bundled
  // into the app), so they get Node globals instead of the browser globals
  // the rest of the source tree implicitly assumes.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
)
