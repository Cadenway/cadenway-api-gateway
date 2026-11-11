import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const explicitExports = {
  selector: 'ExportAllDeclaration',
  message: 'Use explicit named exports: a barrel hides what a module exposes.',
};

export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'docs/', '.claude/', '.codex/']),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      // NestJS modules are classes that only carry a decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      'no-restricted-syntax': ['error', explicitExports],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '\\.\\./waypoint-',
              message: 'Never import sibling sources: use the published @waypoint/* packages.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/clients/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        explicitExports,
        {
          selector: 'Literal[value=/^https?:\\/\\/[a-z0-9-]+-service\\b/]',
          message:
            'Internal services are reached only through the generated clients of src/clients/.',
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' },
  },
  prettier,
);
