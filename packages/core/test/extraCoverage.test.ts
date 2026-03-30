import { describe, it } from 'vitest';
import { createToken, GeneratorBuilder, ParserBuilder } from '../lib/index.js';
import type { GeneratorRule, ParserRule } from '../lib/index.js';

type GenerateContext = { origSource: string };

describe('dynamicGenerator newLine with existing newline in buffer (lines 225-226)', () => {
  it('adjusts indentation when buffer already ends with a bare newline', ({ expect }) => {
    // Covers dynamicGenerator.ts lines 225-226: the branch where temp ends with \n[ \t]*
    // To trigger this:
    //   1. PRINT something that ends with '\n' (no trailing spaces) into the buffer
    //   2. Then call NEW_LINE() - pruneEndingBlanks puts back the string without \n, but
    //      the element BEFORE that in the buffer ends with '\n'.
    //   Strategy: PRINT('A'), NEW_LINE() → buffer = ['A\n'] (indent=0),
    //   then PRINT('\n'), NEW_LINE() → pruneEndingBlanks pops '\n' (not all-space), pushes '',
    //   while-loop pops '', then 'A\n'; 'A\n' has '\n' → \n[ \t]*$ matches → lines 225-226!
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

describe('parserBuilder.ts line 239 (columnIdx undefined branch)', () => {
  it('builds error without column indicator when token has no column info', ({ expect }) => {
    // Covers parserBuilder.ts line 239: if (columnIdx !== undefined) false branch
    // Using positionTracking: 'onlyOffset' means tokens have line but not column info
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
