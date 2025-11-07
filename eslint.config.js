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
		files: ['**/*.svelte'],
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
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_'
				}
			],
			'@typescript-eslint/array-type': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/no-invalid-void-type': 'off',
			'@typescript-eslint/consistent-indexed-object-style': 'off',
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/no-inferrable-types': 'warn',
			'@typescript-eslint/no-dynamic-delete': 'warn',
			'@typescript-eslint/no-unused-expressions': 'warn',
			'prefer-const': 'warn',
			'no-useless-escape': 'warn',
			'svelte/no-at-html-tags': 'warn',
			'svelte/no-unused-svelte-ignore': 'warn',
			'svelte/valid-compile': 'off' // Disable custom element warnings
		}
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'src/lib/api/generated/**',
			'src/lib/paraglide/**',
			'*.config.js',
			'*.config.ts'
		]
	}
];
