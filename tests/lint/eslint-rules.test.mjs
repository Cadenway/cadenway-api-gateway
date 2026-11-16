import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint, Linter, RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import memberRegions from '../../rules/member-regions.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

it('requires prose and types at export boundaries and accepts local inference', async () => {
  const config = await new ESLint().calculateConfigForFile('src/main.ts');
  const linter = new Linter();
  const lint = (code) =>
    linter.verify(code, {
      languageOptions: { parser: tseslint.parser },
      plugins: {
        jsdoc: config.plugins.jsdoc,
        '@typescript-eslint': config.plugins['@typescript-eslint'],
      },
      rules: Object.fromEntries(
        Object.entries(config.rules).filter(
          ([name]) =>
            name.startsWith('jsdoc/') ||
            name === '@typescript-eslint/explicit-module-boundary-types',
        ),
      ),
    });
  assert(
    lint('export class Example {}').some((message) => message.ruleId === 'jsdoc/require-jsdoc'),
  );
  assert(
    lint('export interface Example {}').some((message) => message.ruleId === 'jsdoc/require-jsdoc'),
  );
  assert(
    lint('/** Returns a label. */\nexport function label() { return "label"; }').some(
      (message) => message.ruleId === '@typescript-eslint/explicit-module-boundary-types',
    ),
  );
  assert.deepEqual(
    lint(
      '/** Returns the caller-supplied label. */\nexport function label(value: string): string { const copy = value; return copy; }\nfunction helper() { return 1; }',
    ),
    [],
  );
  assert.equal(config.rules['@typescript-eslint/typedef'], undefined);
});

it('enforces pure type imports and preserves Nest decorator metadata', async () => {
  const config = await new ESLint().calculateConfigForFile('src/main.ts');
  const linter = new Linter();
  const lint = (code) =>
    linter.verify(code, {
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { experimentalDecorators: true, emitDecoratorMetadata: true },
      },
      plugins: { '@typescript-eslint': config.plugins['@typescript-eslint'] },
      rules: {
        '@typescript-eslint/consistent-type-imports':
          config.rules['@typescript-eslint/consistent-type-imports'],
      },
    });
  assert(
    lint("import { Port } from './port.js'; export type Contract = Port;").some(
      (message) => message.ruleId === '@typescript-eslint/consistent-type-imports',
    ),
  );
  assert.deepEqual(
    lint(
      "import { Provider } from './provider.js'; @Injectable() class Adapter { constructor(provider: Provider) {} }",
    ),
    [],
  );
});

tester.run('member-regions', memberRegions, {
  valid: [
    {
      code: 'class Example {\n  // #region Properties\n  /** Property. */\n  public value: string = "";\n  // #endregion\n}',
    },
  ],
  invalid: [
    {
      code: 'class Example { public value: string = ""; }',
      errors: [{ messageId: 'open' }, { messageId: 'close' }],
    },
  ],
});
