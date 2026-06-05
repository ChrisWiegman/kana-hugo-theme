import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

const sharedRules = {
	// formatting
	'@stylistic/indent': ['error', 'tab'],
	'@stylistic/quotes': ['error', 'single'],
	'@stylistic/semi': ['error', 'always'],
	'@stylistic/comma-dangle': ['error', 'always-multiline'],
	'@stylistic/object-curly-spacing': ['error', 'always'],
	'@stylistic/array-bracket-spacing': ['error', 'never'],
	'@stylistic/arrow-parens': ['error', 'always'],
	'@stylistic/brace-style': ['error', '1tbs'],
	'@stylistic/space-before-function-paren': ['error', { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
	'@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
	'@stylistic/keyword-spacing': ['error', { before: true, after: true }],
	'@stylistic/space-before-blocks': 'error',
	'@stylistic/space-infix-ops': 'error',
	'@stylistic/no-trailing-spaces': 'error',
	'@stylistic/eol-last': ['error', 'always'],
	'@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
	'@stylistic/comma-spacing': ['error', { before: false, after: true }],
	'@stylistic/space-in-parens': ['error', 'never'],
	'@stylistic/function-call-spacing': ['error', 'never'],
	'@stylistic/template-curly-spacing': ['error', 'never'],
	'@stylistic/rest-spread-spacing': ['error', 'never'],
	'@stylistic/spaced-comment': ['error', 'always'],
	'@stylistic/semi-spacing': ['error', { before: false, after: true }],
	'@stylistic/no-whitespace-before-property': 'error',
	'@stylistic/computed-property-spacing': ['error', 'never'],
	'@stylistic/dot-location': ['error', 'property'],
	'@stylistic/padded-blocks': ['error', 'never'],
	'@stylistic/padding-line-between-statements': [
		'error',
		{ blankLine: 'always', prev: '*', next: 'if' },
		{ blankLine: 'always', prev: 'if', next: '*' },
		{ blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
		{ blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
	],

	// complexity
	'no-regex-spaces': 'error',
	'no-extra-boolean-cast': 'error',
	'no-useless-catch': 'error',
	'no-useless-escape': 'error',

	// correctness
	'no-constant-condition': 'error',
	'no-empty-character-class': 'error',
	'no-empty-pattern': 'error',
	'no-nonoctal-decimal-escape': 'error',
	'no-self-assign': 'error',
	'no-case-declarations': 'error',
	'no-unsafe-finally': 'error',
	'no-unsafe-optional-chaining': 'error',
	'no-unused-labels': 'error',
	'use-isnan': 'error',
	'for-direction': 'error',
	'valid-typeof': ['error', { requireStringLiterals: true }],
	'require-yield': 'error',

	// style
	'no-var': 'error',
	'prefer-const': 'error',
	'no-array-constructor': 'error',
	'prefer-rest-params': 'error',

	// suspicious
	'no-async-promise-executor': 'error',
	'no-compare-neg-zero': 'error',
	'no-console': 'warn',
	'no-constant-binary-expression': 'error',
	'no-control-regex': 'error',
	'no-debugger': 'error',
	'no-duplicate-case': 'error',
	'no-dupe-else-if': 'error',
	'no-empty': 'error',
	'no-fallthrough': 'error',
	'no-global-assign': 'error',
	'no-irregular-whitespace': 'error',
	'no-misleading-character-class': 'error',
	'no-prototype-builtins': 'error',
	'no-shadow-restricted-names': 'error',
	'no-sparse-arrays': 'error',
	'no-unsafe-negation': 'error',
	'no-useless-backreference': 'error',
	'no-with': 'error',
};

export default [
  {
    ignores: [
      'public/**',
      'resources/**',
      'static/reveal.js/**',
      'static/slides/**',
      'node_modules/**',
      'themes/**',
    ],
  },
  js.configs.recommended,
  // Cloudflare Worker source files (ES modules, browser-like Web APIs)
  {
    files: ['stats/*.js'],
    plugins: { '@stylistic': stylistic },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: sharedRules,
  },
  // Node.js CommonJS test files
  {
    files: ['stats/tests/*.test.cjs'],
    plugins: { '@stylistic': stylistic },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: sharedRules,
  },
  // Browser theme scripts (IIFE, script mode)
  {
    files: ['assets/scripts/*.js'],
    plugins: { '@stylistic': stylistic },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: sharedRules,
  },
  // Playwright config and E2E tests (Node.js)
  {
    files: [
      'playwright.config.js',
      'e2e/**/*.js',
    ],
    plugins: { '@stylistic': stylistic },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: sharedRules,
  },
  // Node.js utility scripts (ES modules)
  {
    files: ['scripts/*.mjs'],
    plugins: { '@stylistic': stylistic },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: sharedRules,
  },
];
