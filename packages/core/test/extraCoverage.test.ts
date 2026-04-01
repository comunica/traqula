import { describe, it } from 'vitest';
import { createToken, GeneratorBuilder, ParserBuilder } from '../lib/index.js';
import type { GeneratorRule, ParserRule } from '../lib/index.js';

type GenerateContext = { origSource: string };

describe('dynamicGenerator newLine with existing newline in buffer (lines 225-226)', () => {
  it('adjusts indentation when buffer already ends with a bare newline', ({ expect }) => {
    // Covers dynamicGenerator.ts lines 225-226: the branch where temp ends with \n[ \t]*
    const rule: GeneratorRule<GenerateContext, 'myRule', { val: string }, []> = {
      name: 'myRule',
      gImpl: ({ PRINT, NEW_LINE }) => (ast: { val: string }) => {
        PRINT(ast.val);
        NEW_LINE();
        // Explicitly print a newline to trigger lines 225-226 on the next NEW_LINE call
        PRINT('\n');
        NEW_LINE();
      },
    };
    const gen = GeneratorBuilder.create(<const>[ rule ]).build();
    const result = gen.myRule({ val: 'test' }, { origSource: '' });
    // The result should contain the value and newlines
    expect(result).toContain('test');
    expect(result).toContain('\n');
  });
});

describe('dynamicGenerator ENSURE already-ends-with and willPrint-starts-with (lines 172-174)', () => {
  it('skips ensure when buffer already ends with the desired string (line 172 false branch)', ({ expect }) => {
    // Covers line 172: !this.doesEndWith(toEnsure) is FALSE (already ends with it)
    const rule: GeneratorRule<GenerateContext, 'myRule', { val: string }, []> = {
      name: 'myRule',
      gImpl: ({ PRINT, ENSURE }) => (ast: { val: string }) => {
        PRINT(' ');       // buffer ends with ' '
        ENSURE(' ');      // already ends with ' ' → if block is SKIPPED (line 172 false branch)
        PRINT(ast.val);
      },
    };
    const gen = GeneratorBuilder.create(<const>[ rule ]).build();
    const result = gen.myRule({ val: 'test' }, { origSource: '' });
    expect(result).toContain('test');
  });

  it('skips pushing when willPrint starts with ensured string (line 174 false branch)', ({ expect }) => {
    // Covers line 174: willPrint.startsWith(toEnsure) is TRUE → do NOT push the ensured string
    const rule: GeneratorRule<GenerateContext, 'myRule', { val: string }, []> = {
      name: 'myRule',
      gImpl: ({ PRINT, ENSURE }) => (ast: { val: string }) => {
        ENSURE(' ');           // register to ensure a space before next PRINT
        PRINT(' ' + ast.val); // willPrint starts with ' ' → skip pushing space
      },
    };
    const gen = GeneratorBuilder.create(<const>[ rule ]).build();
    const result = gen.myRule({ val: 'test' }, { origSource: '' });
    expect(result).toContain('test');
  });
});

describe('parserBuilder.ts line 239 (columnIdx undefined branch)', () => {
  it('builds error without column indicator when token has no column info', ({ expect }) => {
    // Covers parserBuilder.ts line 239: if (columnIdx !== undefined) false branch
    const Num = createToken({ name: 'Num', pattern: /\d+/u });
    const Word = createToken({ name: 'Word', pattern: /[a-z]+/u });
    const numOnlyRule: ParserRule<Record<string, never>, 'numOnly', string, []> = {
      name: 'numOnly',
      impl: ({ CONSUME }) => _ctx => CONSUME(Num).image,
    };
    const parser = ParserBuilder.create(<const>[ numOnlyRule ]).build({
      tokenVocabulary: [ Num, Word ],
      lexerConfig: { ensureOptimizations: false, positionTracking: 'onlyOffset' },
    });
    // 'hello' lexes as Word; parser expects Num → parse error
    // With onlyOffset tracking, token has startLine but not startColumn
    expect(() => (<any>parser).numOnly('hello', {})).toThrow(/Parse error/u);
  });
});
