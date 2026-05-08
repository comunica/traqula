import { describe, it } from 'vitest';
import { AstCoreFactory, createToken, GeneratorBuilder, ParserBuilder } from '../lib/index.js';
import type { GeneratorRule, ParserRule } from '../lib/index.js';

type GenerateContext = { origSource: string };

describe('dynamicGenerator newLine with existing newline in buffer', () => {
  it('adjusts indentation when buffer already ends with a bare newline', ({ expect }) => {
    const rule: GeneratorRule<GenerateContext, 'myRule', { val: string }, []> = {
      name: 'myRule',
      gImpl: ({ PRINT, NEW_LINE }) => (ast: { val: string }) => {
        PRINT(ast.val);
        NEW_LINE();
        PRINT('\n');
        NEW_LINE();
      },
    };
    const gen = GeneratorBuilder.create(<const>[ rule ]).build();
    const result = gen.myRule({ val: 'test' }, { origSource: '' });
    expect(result).toBe('test\n\n');
  });
});

describe('dynamicGenerator ENSURE already-ends-with and willPrint-starts-with', () => {
  it('skips ensure when buffer already ends with the desired string', ({ expect }) => {
    const rule: GeneratorRule<GenerateContext, 'myRule', { val: string }, []> = {
      name: 'myRule',
      gImpl: ({ PRINT, ENSURE }) => (ast: { val: string }) => {
        // Buffer ends with ' '
        PRINT(' ');
        // Already ends with ' ' -> if block is SKIPPED
        ENSURE(' ');
        PRINT(ast.val);
      },
    };
    const gen = GeneratorBuilder.create(<const>[ rule ]).build();
    const result = gen.myRule({ val: 'test' }, { origSource: '' });
    expect(result).toBe(' test');
  });

  it('skips pushing when willPrint starts with ensured string (line 174 false branch)', ({ expect }) => {
    const rule: GeneratorRule<GenerateContext, 'myRule', { val: string }, []> = {
      name: 'myRule',
      gImpl: ({ PRINT, ENSURE }) => (ast: { val: string }) => {
        // Register to ensure a space before next PRINT
        ENSURE(' ');
        // WillPrint starts with ' ' -> skip pushing space
        PRINT(` ${ast.val}`);
      },
    };
    const gen = GeneratorBuilder.create(<const>[ rule ]).build();
    const result = gen.myRule({ val: 'test' }, { origSource: '' });
    expect(result).toBe(' test');
  });
});

describe('parserBuilder.ts', () => {
  it('builds error without column indicator when token has no column info', ({ expect }) => {
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
    // 'hello' lexes as Word; parser expects Num -> parse error
    // With onlyOffset tracking, token has startLine but not startColumn
    expect(() => (<any>parser).numOnly('hello', {})).toThrow(/Parse error/u);
  });
});

describe('astCoreFactory.isSourceLocation', () => {
  it('returns true for objects with sourceLocationType', ({ expect }) => {
    const factory = new AstCoreFactory();
    expect(factory.isSourceLocation({ sourceLocationType: 'source' })).toBe(true);
  });
  it('returns false for objects without sourceLocationType', ({ expect }) => {
    const factory = new AstCoreFactory();
    expect(factory.isSourceLocation({})).toBe(false);
  });
});

describe('dynamicGenerator ENSURE_EITHER with zero args', () => {
  it('does nothing when called with no arguments', ({ expect }) => {
    const rule: GeneratorRule<GenerateContext, 'myRule', { val: string }, []> = {
      name: 'myRule',
      gImpl: ({ PRINT, ENSURE_EITHER }) => (ast: { val: string }) => {
        PRINT(ast.val);
        ENSURE_EITHER();
      },
    };
    const gen = GeneratorBuilder.create(<const>[ rule ]).build();
    const result = gen.myRule({ val: 'hello' }, { origSource: '' });
    expect(result).toBe('hello');
  });
});
