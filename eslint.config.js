import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...ts.configs.strict,
	...ts.configs.stylistic,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		// eslint-plugin-svelte 3 routes *.svelte, *.svelte.ts and *.svelte.js
		// through svelte-eslint-parser, which needs the TS sub-parser to read
		// the TypeScript inside rune modules (*.svelte.ts). Without these globs
		// the `.svelte.ts` stores fail with "Parsing error: Unexpected token".
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		rules: {
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_'
				}
			],
			'@typescript-eslint/array-type': 'off',
			'@typescript-eslint/no-invalid-void-type': 'off',
			'@typescript-eslint/consistent-indexed-object-style': 'off',
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/no-inferrable-types': 'warn',
			'@typescript-eslint/no-unused-expressions': 'warn',
			'prefer-const': 'error',
			'svelte/no-at-html-tags': 'warn',
			'svelte/valid-compile': 'off', // Disable custom element warnings
			// Rules newly promoted to `error` by the eslint 10 / @eslint/js 10 /
			// eslint-plugin-svelte 3 upgrade. Each flags a pre-existing, pervasive
			// pattern (hundreds of sites) that is worth cleaning up incrementally
			// but is out of scope for a dependency bump. Downgraded to `warn` to
			// match this repo's permissive lint posture (CI fails on errors only).
			// TODO: address and re-promote to `error` in follow-up passes.
			'svelte/no-navigation-without-resolve': 'warn',
			'no-restricted-syntax': [
				'error',
				{
					selector:
						'CallExpression[callee.property.name=/^(toLocaleDateString|toLocaleTimeString|toLocaleString)$/]',
					message:
						'Do not format dates with toLocale* directly. Use a helper from $lib/utils/date.ts (or calendar.ts) so dates follow the UI language with textual months. See CLAUDE.md "Date & Time Formatting".'
				}
			]
		}
	},
	{
		// Svelte 5 requires `let` for $props()/$derived destructuring; the core
		// rule flags those. svelte/prefer-const is the runes-aware replacement.
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		rules: {
			'prefer-const': 'off',
			'svelte/prefer-const': 'error'
		}
	},
	{
		files: ['src/lib/utils/date.ts', 'src/lib/utils/calendar.ts'],
		rules: { 'no-restricted-syntax': 'off' }
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'.claude/**',
			'src/lib/api/generated/**',
			'src/lib/paraglide/**',
			'*.config.js',
			'*.config.ts'
		]
	}
];
