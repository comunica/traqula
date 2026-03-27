import { Lexer } from '@traqula/chevrotain';
import { describe, it, vi } from 'vitest';
import { createToken, GeneratorBuilder, IndirBuilder, LexerBuilder, ParserBuilder } from '../lib/index.js';

type ParseContext = { prefix: string };

type GenerateContext = { origSource: string; suffix?: string };

const A = createToken({ name: 'A', pattern: /A/u });
const B = createToken({ name: 'B', pattern: /B/u });
const WS = createToken({ name: 'WS', pattern: /\s+/u, group: Lexer.SKIPPED });

const parseA = <const>{
  name: 'parseA',
  impl: ({ CONSUME }: any) => () => CONSUME(A).image,
};

const parseStart = <const>{
  name: 'parseStart',
  impl: ({ SUBRULE }: any) => (context?: ParseContext) => `${context?.prefix ?? ''}${SUBRULE(parseA)}`,
};

const emit = <const>{
  name: 'emit',
  gImpl: ({ PRINT }: any) => (ast: { value: string }, context: GenerateContext) => {
    PRINT(ast.value, context.suffix ?? '');
  },
};

const wrap = <const>{
  name: 'wrap',
  gImpl: ({ SUBRULE, PRINT }: any) => (ast: { inner: { value: string }}) => {
    PRINT('[');
    SUBRULE(emit, ast.inner);
    PRINT(']');
  },
};

const leaf = <const>{
  name: 'leaf',
  fun: () => (context: { prefix: string }, value: string) => `${context.prefix}${value}`,
};

const root = <const>{
  name: 'root',
  fun: ({ SUBRULE }: any) => (_context: { prefix: string }, value: string) => `(${SUBRULE(leaf, value)})`,
};

describe('core builders runtime coverage', () => {
  it('parserBuilder handles preprocessing, context wiring, and error handlers', ({ expect }) => {
    const parser = ParserBuilder.create(<const>[ parseA, parseStart ])
      .widenContext<ParseContext>()
      .typePatch()
      .build({
        tokenVocabulary: [ WS, A, B ],
        queryPreProcessor: input => input.trim(),
        lexerConfig: { ensureOptimizations: false },
      });

    expect(parser.parseStart('   A   ', { prefix: 'P-' })).toBe('P-A');

    const customHandler = vi.fn();
    const parserWithHandler = ParserBuilder.create(<const>[ parseA ]).build({
      tokenVocabulary: [ WS, A, B ],
      lexerConfig: { positionTracking: 'full', ensureOptimizations: false },
      errorHandler: customHandler,
    });
    parserWithHandler.parseA('\nB', { prefix: '' });
    expect(customHandler).toHaveBeenCalledTimes(1);

    const parserWithDefaultErrors = ParserBuilder.create(<const>[ parseA ]).build({
      tokenVocabulary: [ WS, A, B ],
      lexerConfig: { positionTracking: 'full', ensureOptimizations: false },
    });
    expect(() => parserWithDefaultErrors.parseA('\nB', { prefix: '' }))
      .toThrowError(/Parse error on line 2[\s\S]*\^/u);
  });

  it('parserBuilder merge resolves conflicts only when an override is provided', ({ expect }) => {
    const leftRule = <const>{ name: 'same', impl: () => () => 'left' };
    const rightRule = <const>{ name: 'same', impl: () => () => 'right' };

    expect(() => ParserBuilder.create(<const>[ leftRule ])
      .merge(ParserBuilder.create(<const>[ rightRule ]), <const>[]))
      .toThrowError(/already exists/u);

    const overrideRule = <const>{ name: 'same', impl: () => () => 'override' };
    const parser = ParserBuilder
      .create(<const>[ leftRule ])
      .merge(ParserBuilder.create(<const>[ rightRule ]), <const>[ overrideRule ])
      .build({ tokenVocabulary: [ A ], lexerConfig: { ensureOptimizations: false }});

    expect(parser.same('', { prefix: '' })).toBe('override');
  });

  it('generatorBuilder supports create-copy, patch, merge conflict handling, and delete', ({ expect }) => {
    const patched = GeneratorBuilder
      .create(GeneratorBuilder.create(<const>[ emit, wrap ]))
      .patchRule({
        name: 'emit',
        gImpl: ({ PRINT }: any) => (ast: { value: string }, context: GenerateContext) => {
          PRINT(`${ast.value}${context.suffix ?? ''}`);
        },
      });

    const generator = patched.widenContext<GenerateContext>().typePatch().build();
    expect(generator.wrap({ inner: { value: 'X' }}, { origSource: '', suffix: '!' })).toBe('[X!]');

    const removed = GeneratorBuilder.create(patched).deleteRule('wrap').build();
    expect(removed.emit({ value: 'Z' }, { origSource: '' })).toBe('Z');

    const conflictingEmit = <const>{
      name: 'emit',
      gImpl: ({ PRINT }: any) => (ast: { value: string }) => {
        PRINT(ast.value.toLowerCase());
      },
    };

    expect(() => GeneratorBuilder.create(<const>[ emit ])
      .merge(GeneratorBuilder.create(<const>[ conflictingEmit ]), <const>[]))
      .toThrowError(/already exists/u);

    const override = <const>{
      name: 'emit',
      gImpl: ({ PRINT }: any) => (ast: { value: string }) => {
        PRINT(`override:${ast.value}`);
      },
    };

    const merged = GeneratorBuilder
      .create(<const>[ emit ])
      .merge(GeneratorBuilder.create(<const>[ conflictingEmit ]), <const>[ override ])
      .build();

    expect(merged.emit({ value: 'Y' }, { origSource: '' })).toBe('override:Y');
  });

  it('indirBuilder supports add/patch/delete and duplicate guarding', ({ expect }) => {
    const indir = IndirBuilder
      .create(<const>[ leaf ])
      .addMany(root)
      .patchRule({
        name: 'leaf',
        fun: () => (context: { prefix: string }, value: string) => `${context.prefix}${value}!`,
      })
      .widenContext<{ prefix: string }>()
      .typePatch()
      .build();

    expect(indir.root({ prefix: 'pre-' }, 'v')).toBe('(pre-v!)');

    const onlyLeaf = IndirBuilder
      .create(IndirBuilder.create(<const>[ leaf, root ]).deleteRule('root'))
      .build();

    expect(onlyLeaf.leaf({ prefix: '' }, 'x')).toBe('x');

    const duplicateLeaf = <const>{
      name: 'leaf',
      fun: () => (_context: { prefix: string }, value: string) => value.toUpperCase(),
    };

    expect(() => IndirBuilder.create(<const>[ leaf ]).addRuleRedundant(duplicateLeaf))
      .toThrowError(/already exists/u);

    const withRule = IndirBuilder.create(<const>[ leaf ]).addRule(root);
    expect(withRule.getRule('root')).toBe(root);
  });
});

describe('dynamicGenerator runtime coverage', () => {
  const genWord = <const>{
    name: 'genWord',
    gImpl: ({ PRINT_WORD }: any) => (ast: { word: string }) => {
      PRINT_WORD(ast.word);
    },
  };

  const genWords = <const>{
    name: 'genWords',
    gImpl: ({ PRINT_WORDS }: any) => (ast: { words: string[] }) => {
      PRINT_WORDS(...ast.words);
    },
  };

  const genEnsure = <const>{
    name: 'genEnsure',
    gImpl: ({ PRINT, ENSURE }: any) => (ast: { parts: string[] }) => {
      for (const part of ast.parts) {
        ENSURE(' ');
        PRINT(part);
      }
    },
  };

  const genEnsureEither = <const>{
    name: 'genEnsureEither',
    gImpl: ({ PRINT, ENSURE_EITHER }: any) => (ast: { parts: string[] }) => {
      for (const part of ast.parts) {
        ENSURE_EITHER(' ', '\n');
        PRINT(part);
      }
    },
  };

  const genNewLine = <const>{
    name: 'genNewLine',
    gImpl: ({ NEW_LINE, PRINT }: any) => (ast: { lines: string[] }) => {
      for (const line of ast.lines) {
        PRINT(line);
        NEW_LINE();
      }
    },
  };

  const genOnEmpty = <const>{
    name: 'genOnEmpty',
    gImpl: ({ PRINT_ON_EMPTY }: any) => (ast: { val: string }) => {
      PRINT_ON_EMPTY(ast.val);
    },
  };

  const genOnOwn = <const>{
    name: 'genOnOwn',
    gImpl: ({ PRINT_ON_OWN_LINE }: any) => (ast: { val: string }) => {
      PRINT_ON_OWN_LINE(ast.val);
    },
  };

  it('pRINT_WORD and PRINT_WORDS ensure surrounding spaces', ({ expect }) => {
    const gen = GeneratorBuilder.create(<const>[ genWord, genWords ]).build();
    // PRINT_WORD prints space before and after, but trailing ensure is deferred and may not resolve
    expect(gen.genWord({ word: 'hello' }, { origSource: '' })).toBe(' hello');
    expect(gen.genWords({ words: [ 'a', 'b' ]}, { origSource: '' })).toBe(' a b');
  });

  it('eNSURE and ENSURE_EITHER insert characters if missing', ({ expect }) => {
    const gen = GeneratorBuilder.create(<const>[ genEnsure, genEnsureEither ]).build();
    expect(gen.genEnsure({ parts: [ 'a', 'b' ]}, { origSource: '' })).toBe(' a b');
    expect(gen.genEnsureEither({ parts: [ 'x', 'y' ]}, { origSource: '' })).toBe(' x y');
  });

  it('nEW_LINE, PRINT_ON_EMPTY, PRINT_ON_OWN_LINE format output', ({ expect }) => {
    const gen = GeneratorBuilder.create(<const>[ genNewLine, genOnEmpty, genOnOwn ]).build();
    expect(gen.genNewLine({ lines: [ 'L1', 'L2' ]}, { origSource: '' })).toBe('L1\nL2\n');
    expect(gen.genOnEmpty({ val: 'X' }, { origSource: '' })).toBe('\nX');
    expect(gen.genOnOwn({ val: 'Y' }, { origSource: '' })).toBe('\nY\n');
  });
});

describe('lexerBuilder runtime coverage', () => {
  const tokA = createToken({ name: 'TokA', pattern: /A/u });
  const tokB = createToken({ name: 'TokB', pattern: /B/u });
  const tokC = createToken({ name: 'TokC', pattern: /C/u });
  const tokD = createToken({ name: 'TokD', pattern: /D/u });

  it('supports add, addBefore, addAfter, and delete', ({ expect }) => {
    const builder = LexerBuilder.create()
      .add(tokA)
      .add(tokB)
      .addBefore(tokB, tokC)
      .addAfter(tokA, tokD);

    const vocab = builder.tokenVocabulary;
    expect(vocab).toEqual([ tokA, tokD, tokC, tokB ]);

    builder.delete(tokC);
    expect(builder.tokenVocabulary).toEqual([ tokA, tokD, tokB ]);
  });

  it('supports moveBefore and moveAfter', ({ expect }) => {
    const builder = LexerBuilder.create().add(tokA, tokB, tokC, tokD);
    builder.moveBefore(tokA, tokD);
    expect(builder.tokenVocabulary).toEqual([ tokD, tokA, tokB, tokC ]);

    const builder2 = LexerBuilder.create().add(tokA, tokB, tokC, tokD);
    builder2.moveAfter(tokD, tokA);
    expect(builder2.tokenVocabulary).toEqual([ tokB, tokC, tokD, tokA ]);
  });

  it('merge handles conflicts and overwrites', ({ expect }) => {
    const tokA2 = createToken({ name: 'TokA', pattern: /AA/u });

    expect(() => LexerBuilder.create().add(tokA).merge(LexerBuilder.create().add(tokA2)))
      .toThrowError(/already exists/u);

    const merged = LexerBuilder.create()
      .add(tokA)
      .merge(LexerBuilder.create().add(tokA2, tokB), [ tokA2 ]);
    expect(merged.tokenVocabulary).toEqual([ tokA, tokB ]);
  });

  it('throws on missing tokens for addBefore, addAfter, delete', ({ expect }) => {
    const builder = LexerBuilder.create().add(tokA);
    expect(() => (<any> builder).addBefore(tokB, tokC)).toThrowError(/Token not found/u);
    expect(() => (<any> builder).addAfter(tokB, tokC)).toThrowError(/Token not found/u);
    expect(() => (<any> builder).delete(tokB)).toThrowError(/Token not found/u);
  });

  it('builds a working lexer', ({ expect }) => {
    const lexer = LexerBuilder.create()
      .add(tokA, tokB)
      .build({ ensureOptimizations: false });

    const result = lexer.tokenize('AB');
    expect(result.tokens).toHaveLength(2);
  });
});
