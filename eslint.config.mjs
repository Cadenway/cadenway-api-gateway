import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import documentation from './rules/documentation.mjs';
import memberRegions from './rules/member-regions.mjs';

const explicitExports = {
  selector: 'ExportAllDeclaration',
  message: 'Use explicit named exports: a barrel hides what a module exposes.',
};

// Packages the dependency review rejected, with what replaces each one. A sub-path import is
// refused too.
const rejectedPackages = [
  [
    '@nestjs/schedule',
    'No durability: durable jobs belong to a service, through @cadenway/nest-jobs.',
  ],
  ['@nestjs/throttler', 'Rate limiting uses rate-limiter-flexible with the Redis counters.'],
  [
    '@opentelemetry/instrumentation-nestjs-core',
    'No NestJS 12 support: spans come from the interceptor of @cadenway/nest-common.',
  ],
  [
    '@opentelemetry/instrumentation-router',
    'Duplicate spans under Express 5: tracing comes from @cadenway/nest-common.',
  ],
  ['axios', 'Use the native fetch, through the clients generated from the contracts.'],
  ['bullmq', 'Durable jobs use pg-boss through @cadenway/nest-jobs, in the owning service.'],
  ['cloudevents', 'The contracts already define the event envelope.'],
  ['date-fns', 'It does not separate a plain date from an instant: dates use Temporal.'],
  ['prom-client', 'Metrics are exported over OTLP by @cadenway/nest-common.'],
].map(([name, message]) => ({ regex: `^${name}(/|$)`, message }));

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
      'no-restricted-imports': ['error', { patterns: rejectedPackages }],
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
              regex: '\\.\\./cadenway-',
              message: 'Never import sibling sources: use the published @cadenway/* packages.',
            },
            ...rejectedPackages,
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
  {
    files: ['src/**/*.ts'],
    plugins: { jsdoc, cadenway: { rules: { documentation, 'member-regions': memberRegions } } },
    linterOptions: { noInlineConfig: true },
    rules: {
      'cadenway/documentation': 'error',
      'cadenway/member-regions': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/typedef': [
        'error',
        {
          variableDeclaration: true,
          memberVariableDeclaration: true,
          arrayDestructuring: true,
          objectDestructuring: true,
        },
      ],
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
            'TSEnumMember',
            'Program > VariableDeclaration',
            'ExportNamedDeclaration[declaration.type="VariableDeclaration"]',
            'ClassDeclaration > ClassBody > PropertyDefinition',
            'ClassDeclaration > ClassBody > MethodDefinition',
            'ClassDeclaration > ClassBody > TSAbstractPropertyDefinition',
            'ClassDeclaration > ClassBody > TSAbstractMethodDefinition',
            'TSInterfaceBody > TSPropertySignature',
            'TSInterfaceBody > TSMethodSignature',
            'TSTypeAliasDeclaration > TSTypeLiteral > TSPropertySignature',
            'TSTypeAliasDeclaration > TSTypeLiteral > TSMethodSignature',
          ],
        },
      ],
      'jsdoc/require-param': [
        'error',
        {
          checkDestructured: false,
          checkDestructuredRoots: false,
          contexts: [
            'FunctionDeclaration',
            'VariableDeclarator > ArrowFunctionExpression',
            'MethodDefinition > FunctionExpression',
            'TSMethodSignature',
          ],
        },
      ],
      'jsdoc/require-param-type': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': [
        'error',
        {
          contexts: [
            'FunctionDeclaration',
            'VariableDeclarator > ArrowFunctionExpression',
            'MethodDefinition > FunctionExpression',
            {
              context: 'TSMethodSignature[returnType.typeAnnotation.type!="TSVoidKeyword"]',
              forceRequireReturn: true,
            },
          ],
        },
      ],
      'jsdoc/require-returns-type': 'error',
      'jsdoc/require-returns-description': 'error',
    },
  },
  prettier,
);
