import { Lexer } from '@traqula/chevrotain';
import { describe, it, vi } from 'vitest';
import type { GeneratorRule, IndirDef, ParserRule } from '../lib/index.js';
import { createToken, GeneratorBuilder, IndirBuilder, LexerBuilder, ParserBuilder } from '../lib/index.js';

type ParseContext = { prefix: string };

type GenerateContext = { origSource: string; suffix?: string };

const A = createToken({ name: 'A', pattern: /A/u });
const B = createToken({ name: 'B', pattern: /B/u });
const WS = createToken({ name: 'WS', pattern: /\s+/u, group: Lexer.SKIPPED });

const parseA: ParserRule<ParseContext, 'parseA', string, []> = {
  name: 'parseA',
  impl: ({ CONSUME }) => () => CONSUME(A).image,
};

const parseStart: ParserRule<ParseContext, 'parseStart', string, []> = {
  name: 'parseStart',
  impl: ({ SUBRULE }) =>
    (context?: ParseContext) => `${context?.prefix ?? ''}${SUBRULE(parseA)}`,
};

const emit: GeneratorRule<GenerateContext, 'emit', { value: string }, []> = {
  name: 'emit',
  gImpl: ({ PRINT }) => (ast, context) => {
    PRINT(ast.value, context.suffix ?? '');
  },
};

const wrap: GeneratorRule<GenerateContext, 'wrap', { inner: { value: string }}, []> = {
  name: 'wrap',
  gImpl: ({ SUBRULE, PRINT }) => (ast) => {
    PRINT('[');
    SUBRULE(emit, ast.inner);
    PRINT(']');
  },
};

const leaf: IndirDef<ParseContext, 'leaf', string, [string]> = <const>{
  name: 'leaf',
  fun: () => (context, value) => `${context.prefix}${value}`,
};

const root: IndirDef<ParseContext, 'root', string, [string]> = {
  name: 'root',
  fun: ({ SUBRULE }) => (_context, value) => `(${SUBRULE(leaf, value)})`,
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
    const leftRule: ParserRule<ParseContext, 'same'> = { name: 'same', impl: () => () => 'left' };
    const rightRule: ParserRule<ParseContext, 'same'> = { name: 'same', impl: () => () => 'right' };

    expect(() => ParserBuilder.create(<const>[ leftRule ])
      .merge(ParserBuilder.create(<const>[ rightRule ]), <const>[]))
      .toThrowError('already exists');

    const overrideRule: ParserRule<ParseContext, 'same'> = { name: 'same', impl: () => () => 'override' };
    const parser = ParserBuilder
      .create(<const>[ leftRule ])
      .merge(ParserBuilder.create(<const>[ rightRule ]), <const>[ overrideRule ])
      .build({ tokenVocabulary: [ A ], lexerConfig: { ensureOptimizations: false }});

    expect(parser.same('', { prefix: '' })).toBe('override');
  });

  it('parserBuilder addRuleRedundant throws on conflicting rule and getRule returns the rule', ({ expect }) => {
    const ruleA: ParserRule<ParseContext, 'ruleX'> = { name: 'ruleX', impl: () => () => 'a' };
    const ruleB: ParserRule<ParseContext, 'ruleX'> = { name: 'ruleX', impl: () => () => 'b' };

    expect(() => ParserBuilder.create(<const>[ ruleA ]).addRuleRedundant(ruleB))
      .toThrowError('already exists');

    const builder = ParserBuilder.create(<const>[ ruleA ]);
    expect(builder.getRule('ruleX')).toBe(ruleA);
  });

  it('generatorBuilder supports create-copy, patch, merge conflict handling, and delete', ({ expect }) => {
    const patched = GeneratorBuilder
      .create(GeneratorBuilder.create(<const>[ emit, wrap ]))
      .patchRule({
        name: 'emit',
        gImpl: ({ PRINT }) => (ast: { value: string }, context: GenerateContext) => {
          PRINT(`${ast.value}${context.suffix ?? ''}`);
        },
      });

    const generator = patched.widenContext<GenerateContext>().typePatch().build();
    expect(generator.wrap({ inner: { value: 'X' }}, { origSource: '', suffix: '!' })).toBe('[X!]');

    const removed = GeneratorBuilder.create(patched).deleteRule('wrap').build();
    expect(removed.emit({ value: 'Z' }, { origSource: '' })).toBe('Z');

    const conflictingEmit: GeneratorRule<GenerateContext, 'emit', { value: string }, []> = {
      name: 'emit',
      gImpl: ({ PRINT }) => (ast) => {
        PRINT(ast.value.toLowerCase());
      },
    };

    expect(() => GeneratorBuilder.create(<const>[ emit ])
      .merge(GeneratorBuilder.create(<const>[ conflictingEmit ]), <const>[]))
      .toThrowError('already exists');

    const override: GeneratorRule<GenerateContext, 'emit', { value: string }, []> = {
      name: 'emit',
      gImpl: ({ PRINT }) => (ast) => {
        PRINT(`override:${ast.value}`);
      },
    };

    const merged = GeneratorBuilder
      .create(<const>[ emit ])
      .merge(GeneratorBuilder.create(<const>[ conflictingEmit ]), <const>[ override ])
      .build();

    expect(merged.emit({ value: 'Y' }, { origSource: '' })).toBe('override:Y');
  });

  it('generatorBuilder removes the named rule from the builder bis', ({ expect }) => {
    const ruleA: GeneratorRule<GenerateContext, 'ruleA'> = { name: 'ruleA', gImpl: () => () => 'a' };
    const builder = GeneratorBuilder.create(<const>[ ruleA ]);
    const smaller = builder.deleteMany('ruleA');
    // The private rules record should no longer contain 'num'
    expect((<any>smaller).rules.ruleA).toBeUndefined();
  });

  it('generatorBuilder removes the named rules from the builder', ({ expect }) => {
    const ruleA: GeneratorRule<GenerateContext, 'ruleA'> = { name: 'ruleA', gImpl: () => () => 'a' };
    const ruleB: GeneratorRule<GenerateContext, 'ruleB'> = { name: 'ruleB', gImpl: () => () => 'b' };
    const builder = GeneratorBuilder.create(<const>[ ruleA, ruleB ]);
    expect((<any>builder).rules.ruleA).toBeDefined();
    expect((<any>builder).rules.ruleB).toBeDefined();
    const smaller = builder.deleteMany('ruleA', 'ruleB');
    // The private rules record should no longer contain 'num'
    expect((<any>smaller).rules.rulA).toBeUndefined();
    expect((<any>smaller).rules.ruleB).toBeUndefined();
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

    const duplicateLeaf: IndirDef<ParseContext, 'leaf', string, [string]> = {
      name: 'leaf',
      fun: () => (_context, value) => value.toUpperCase(),
    };

    expect(() => IndirBuilder.create(<const>[ leaf ]).addRuleRedundant(duplicateLeaf))
      .toThrowError('already exists');

    const withRule = IndirBuilder.create(<const>[ leaf ]).addRule(root);
    expect(withRule.getRule('root')).toBe(root);
  });

  it('generatorBuilder.addRuleRedundant throws on conflicting rule', ({ expect }) => {
    const emitA: GeneratorRule<GenerateContext, 'emit', { value: string }, []> = {
      name: 'emit',
      gImpl: ({ PRINT }) => (ast) => {
        PRINT(ast.value);
      },
    };
    const emitB: GeneratorRule<GenerateContext, 'emit', { value: string }, []> = {
      name: 'emit',
      gImpl: ({ PRINT }) => (ast) => {
        PRINT(ast.value.toUpperCase());
      },
    };
    expect(() => GeneratorBuilder.create(<const>[ emitA ]).addRuleRedundant(emitB))
      .toThrowError('already exists');
  });

  it('dynamicIndirected throws when calling a rule not found in the built indir', ({ expect }) => {
    // Build an indir where 'root' references 'leaf' via SUBRULE
    const badRoot: IndirDef<ParseContext, 'root', string, [string]> = {
      name: 'root',
      fun: ({ SUBRULE }) => (_context, value) => `(${SUBRULE(leaf, value)})`,
    };
    // Build with ONLY badRoot (no leaf), so leaf is not registered
    const indir = IndirBuilder.create(<const>[ badRoot ]).build();
    // Calling root tries to SUBRULE(leaf) which is not found
    expect(() => indir.root({ prefix: '' }, 'x')).toThrowError('not found');
  });
});

describe('dynamicGenerator runtime coverage', () => {
  const genWord: GeneratorRule<GenerateContext, 'genWord', { word: string }, []> = {
    name: 'genWord',
    gImpl: ({ PRINT_WORD }) => (ast) => {
      PRINT_WORD(ast.word);
    },
  };

  const genWords: GeneratorRule<GenerateContext, 'genWords', { words: string[] }, []> = {
    name: 'genWords',
    gImpl: ({ PRINT_WORDS }) => (ast) => {
      PRINT_WORDS(...ast.words);
    },
  };

  const genEnsure: GeneratorRule<GenerateContext, 'genEnsure', { parts: string[] }, []> = {
    name: 'genEnsure',
    gImpl: ({ PRINT, ENSURE }) => (ast) => {
      for (const part of ast.parts) {
        ENSURE(' ');
        PRINT(part);
      }
    },
  };

  const genEnsureEither: GeneratorRule<GenerateContext, 'genEnsureEither', { parts: string[] }, []> = {
    name: 'genEnsureEither',
    gImpl: ({ PRINT, ENSURE_EITHER }) => (ast: { parts: string[] }) => {
      for (const part of ast.parts) {
        ENSURE_EITHER(' ', '\n');
        PRINT(part);
      }
    },
  };

  const genNewLine: GeneratorRule<GenerateContext, 'genNewLine', { lines: string[] }, []> = {
    name: 'genNewLine',
    gImpl: ({ NEW_LINE, PRINT }) => (ast) => {
      for (const line of ast.lines) {
        PRINT(line);
        NEW_LINE();
      }
    },
  };

  const genOnEmpty: GeneratorRule<GenerateContext, 'genOnEmpty', { val: string }, []> = {
    name: 'genOnEmpty',
    gImpl: ({ PRINT_ON_EMPTY }) => (ast) => {
      PRINT_ON_EMPTY(ast.val);
    },
  };

  const genOnOwn: GeneratorRule<GenerateContext, 'genOnOwn', { val: string }, []> = {
    name: 'genOnOwn',
    gImpl: ({ PRINT_ON_OWN_LINE }) => (ast) => {
      PRINT_ON_OWN_LINE(ast.val);
    },
  };

  it('x PRINT_WORD and PRINT_WORDS ensure surrounding spaces', ({ expect }) => {
    const gen = GeneratorBuilder.create(<const>[ genWord, genWords ]).build();
    // PRINT_WORD prints space before and after, but trailing ensure is deferred and may not resolve
    expect(gen.genWord({ word: 'hello' }, { origSource: '' })).toBe(' hello ');
    expect(gen.genWords({ words: [ 'a', 'b' ]}, { origSource: '' })).toBe(' a b ');
  });

  it('x ENSURE and ENSURE_EITHER insert characters if missing', ({ expect }) => {
    const gen = GeneratorBuilder.create(<const>[ genEnsure, genEnsureEither ]).build();
    expect(gen.genEnsure({ parts: [ 'a', 'b' ]}, { origSource: '' })).toBe(' a b');
    expect(gen.genEnsureEither({ parts: [ 'x', 'y' ]}, { origSource: '' })).toBe(' x y');
  });

  it('x ENSURE_EITHER with single arg delegates to ensure', ({ expect }) => {
    const genEnsureEitherSingle: GeneratorRule<GenerateContext, 'genEnsureEitherSingle', { val: string }, []> = {
      name: 'genEnsureEitherSingle',
      gImpl: ({ PRINT, ENSURE_EITHER }) => (ast: { val: string }) => {
        ENSURE_EITHER(' ');
        PRINT(ast.val);
      },
    };
    const gen = GeneratorBuilder.create(<const>[ genEnsureEitherSingle ]).build();
    expect(gen.genEnsureEitherSingle({ val: 'x' }, { origSource: '' })).toBe(' x');
  });

  it('x NEW_LINE with force=true forces a newline', ({ expect }) => {
    const genForceNewLine: GeneratorRule<GenerateContext, 'genForceNewLine', { val: string }, []> = {
      name: 'genForceNewLine',
      gImpl: ({ PRINT, NEW_LINE }) => (ast: { val: string }) => {
        PRINT(ast.val);
        NEW_LINE({ force: true });
        NEW_LINE({ force: true });
      },
    };
    const gen = GeneratorBuilder.create(<const>[ genForceNewLine ]).build();
    expect(gen.genForceNewLine({ val: 'hi' }, { origSource: '' })).toBe('hi\n\n');
  });

  it('x SUBRULE throws when rule not found in generator', ({ expect }) => {
    const genCallMissing: GeneratorRule<GenerateContext, 'genCallMissing', { val: string }, []> = {
      name: 'genCallMissing',
      gImpl: ({ SUBRULE }) => (ast: { val: string }) => {
        SUBRULE(genWord, { word: ast.val });
      },
    };
    const gen = GeneratorBuilder.create(<const>[ genCallMissing ]).build();
    expect(() => gen.genCallMissing({ val: 'x' }, { origSource: '' })).toThrowError('not found');
  });

  it('x NEW_LINE, PRINT_ON_EMPTY, PRINT_ON_OWN_LINE format output', ({ expect }) => {
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

    // Merging with same token object (not a conflict - returns false in filter, no re-add)
    const mergedSame = LexerBuilder.create().add(tokA).merge(LexerBuilder.create().add(tokA));
    expect(mergedSame.tokenVocabulary).toEqual([ tokA ]);
  });

  it('throws on missing tokens for moveBefore and moveAfter', ({ expect }) => {
    const builder = LexerBuilder.create().add(tokA, tokB);
    // MoveBefore with not-found 'before' token
    expect(() => (<any> builder).moveBefore(<any> tokC, tokA)).toThrowError(/BeforeToken not found/u);
    // MoveAfter with not-found 'token to move'
    expect(() => (<any> builder).moveAfter(tokA, tokC)).toThrowError(/Token not found/u);
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

describe('dynamicParser - numbered alternatives coverage', () => {
  const DynA = createToken({ name: 'DynA', pattern: /A/u });
  const DynB = createToken({ name: 'DynB', pattern: /B/u });
  const DynC = createToken({ name: 'DynC', pattern: /C/u });
  const DynD = createToken({ name: 'DynD', pattern: /D/u });
  const DynE = createToken({ name: 'DynE', pattern: /E/u });
  const DynF = createToken({ name: 'DynF', pattern: /F/u });
  const DynG = createToken({ name: 'DynG', pattern: /G/u });
  const DynH = createToken({ name: 'DynH', pattern: /H/u });
  const DynI = createToken({ name: 'DynI', pattern: /I/u });
  const DynCOMMA = createToken({ name: 'DynCOMMA', pattern: /,/u });
  const DynWS = createToken({ name: 'DynWS', pattern: /\s+/u, group: Lexer.SKIPPED });

  const dynVocab = [ DynWS, DynCOMMA, DynA, DynB, DynC, DynD, DynE, DynF, DynG, DynH, DynI ];

  const dA: ParserRule<object, 'dA', string, []> = {
    name: 'dA',
    impl: ({ CONSUME }) => () => CONSUME(DynA).image,
  };
  const dB: ParserRule<object, 'dB', string, []> = {
    name: 'dB',
    impl: ({ CONSUME }) => () => CONSUME(DynB).image,
  };
  const dC: ParserRule<object, 'dC', string, []> = {
    name: 'dC',
    impl: ({ CONSUME }) => () => CONSUME(DynC).image,
  };
  const dD: ParserRule<object, 'dD', string, []> = {
    name: 'dD',
    impl: ({ CONSUME }) => () => CONSUME(DynD).image,
  };
  const dE: ParserRule<object, 'dE', string, []> = {
    name: 'dE',
    impl: ({ CONSUME }) => () => CONSUME(DynE).image,
  };

  const dConsume: ParserRule<object, 'dConsume', void, []> = {
    name: 'dConsume',
    impl: ({ CONSUME4, CONSUME5, CONSUME6, CONSUME7, CONSUME8, CONSUME9 }) => () => {
      CONSUME4(DynA);
      CONSUME5(DynB);
      CONSUME6(DynC);
      CONSUME7(DynD);
      CONSUME8(DynE);
      CONSUME9(DynF);
    },
  };

  const dSubrule: ParserRule<object, 'dSubrule', void, []> = {
    name: 'dSubrule',
    impl: ({ SUBRULE5, SUBRULE6, SUBRULE7, SUBRULE8, SUBRULE9 }) => () => {
      SUBRULE5(dA);
      SUBRULE6(dB);
      SUBRULE7(dC);
      SUBRULE8(dD);
      SUBRULE9(dE);
    },
  };

  const dOption: ParserRule<object, 'dOption', void, []> = {
    name: 'dOption',
    impl: ({ OPTION5, OPTION6, OPTION7, OPTION8, OPTION9, CONSUME }) => () => {
      OPTION5(() => {
        CONSUME(DynA);
      });
      OPTION6(() => {
        CONSUME(DynB);
      });
      OPTION7(() => {
        CONSUME(DynC);
      });
      OPTION8(() => {
        CONSUME(DynD);
      });
      OPTION9(() => {
        CONSUME(DynE);
      });
    },
  };

  const dOr5: ParserRule<object, 'dOr5', void, []> = {
    name: 'dOr5',
    impl: ({ OR5, CONSUME }) => () => {
      OR5([{ ALT: () => CONSUME(DynA) }, { ALT: () => CONSUME(DynB) }]);
    },
  };
  const dOr6: ParserRule<object, 'dOr6', void, []> = {
    name: 'dOr6',
    impl: ({ OR6, CONSUME }) => () => {
      OR6([{ ALT: () => CONSUME(DynC) }, { ALT: () => CONSUME(DynD) }]);
    },
  };
  const dOr7: ParserRule<object, 'dOr7', void, []> = {
    name: 'dOr7',
    impl: ({ OR7, CONSUME }) => () => {
      OR7([{ ALT: () => CONSUME(DynE) }, { ALT: () => CONSUME(DynF) }]);
    },
  };
  const dOr8: ParserRule<object, 'dOr8', void, []> = {
    name: 'dOr8',
    impl: ({ OR8, CONSUME }) => () => {
      OR8([{ ALT: () => CONSUME(DynG) }, { ALT: () => CONSUME(DynH) }]);
    },
  };
  const dOr9: ParserRule<object, 'dOr9', void, []> = {
    name: 'dOr9',
    impl: ({ OR9, CONSUME }) => () => {
      OR9([{ ALT: () => CONSUME(DynI) }, { ALT: () => CONSUME(DynA) }]);
    },
  };

  const dMany: ParserRule<object, 'dMany', void, []> = {
    name: 'dMany',
    impl: ({ MANY5, MANY6, MANY7, MANY8, MANY9, CONSUME }) => () => {
      MANY5(() => CONSUME(DynA));
      MANY6(() => CONSUME(DynB));
      MANY7(() => CONSUME(DynC));
      MANY8(() => CONSUME(DynD));
      MANY9(() => CONSUME(DynE));
    },
  };

  const dManySep: ParserRule<object, 'dManySep', void, []> = {
    name: 'dManySep',
    impl: ({
      MANY_SEP,
      MANY_SEP1,
      MANY_SEP2,
      MANY_SEP3,
      MANY_SEP4,
      MANY_SEP5,
      MANY_SEP6,
      MANY_SEP7,
      MANY_SEP8,
      MANY_SEP9,
      CONSUME,
    }) => () => {
      MANY_SEP({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      MANY_SEP1({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      MANY_SEP2({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      MANY_SEP3({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      MANY_SEP4({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      MANY_SEP5({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      MANY_SEP6({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      MANY_SEP7({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      MANY_SEP8({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      MANY_SEP9({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
    },
  };

  const dAtLeastOne: ParserRule<object, 'dAtLeastOne', void, []> = {
    name: 'dAtLeastOne',
    impl: ({
      AT_LEAST_ONE1,
      AT_LEAST_ONE2,
      AT_LEAST_ONE3,
      AT_LEAST_ONE4,
      AT_LEAST_ONE5,
      AT_LEAST_ONE6,
      AT_LEAST_ONE7,
      AT_LEAST_ONE8,
      AT_LEAST_ONE9,
      CONSUME,
    }) => () => {
      AT_LEAST_ONE1(() => CONSUME(DynA));
      AT_LEAST_ONE2(() => CONSUME(DynB));
      AT_LEAST_ONE3(() => CONSUME(DynC));
      AT_LEAST_ONE4(() => CONSUME(DynD));
      AT_LEAST_ONE5(() => CONSUME(DynE));
      AT_LEAST_ONE6(() => CONSUME(DynF));
      AT_LEAST_ONE7(() => CONSUME(DynG));
      AT_LEAST_ONE8(() => CONSUME(DynH));
      AT_LEAST_ONE9(() => CONSUME(DynI));
    },
  };

  const dAtLeastOneSep: ParserRule<object, 'dAtLeastOneSep', void, []> = {
    name: 'dAtLeastOneSep',
    impl: ({
      AT_LEAST_ONE_SEP1,
      AT_LEAST_ONE_SEP2,
      AT_LEAST_ONE_SEP3,
      AT_LEAST_ONE_SEP4,
      AT_LEAST_ONE_SEP5,
      AT_LEAST_ONE_SEP6,
      AT_LEAST_ONE_SEP7,
      AT_LEAST_ONE_SEP8,
      AT_LEAST_ONE_SEP9,
      CONSUME,
    }) => () => {
      AT_LEAST_ONE_SEP1({ SEP: DynCOMMA, DEF: () => CONSUME(DynA) });
      AT_LEAST_ONE_SEP2({ SEP: DynCOMMA, DEF: () => CONSUME(DynB) });
      AT_LEAST_ONE_SEP3({ SEP: DynCOMMA, DEF: () => CONSUME(DynC) });
      AT_LEAST_ONE_SEP4({ SEP: DynCOMMA, DEF: () => CONSUME(DynD) });
      AT_LEAST_ONE_SEP5({ SEP: DynCOMMA, DEF: () => CONSUME(DynE) });
      AT_LEAST_ONE_SEP6({ SEP: DynCOMMA, DEF: () => CONSUME(DynF) });
      AT_LEAST_ONE_SEP7({ SEP: DynCOMMA, DEF: () => CONSUME(DynG) });
      AT_LEAST_ONE_SEP8({ SEP: DynCOMMA, DEF: () => CONSUME(DynH) });
      AT_LEAST_ONE_SEP9({ SEP: DynCOMMA, DEF: () => CONSUME(DynI) });
    },
  };

  const dBacktrack: ParserRule<object, 'dBacktrack', void, []> = {
    name: 'dBacktrack',
    impl: ({ BACKTRACK, OR, CONSUME }) => () => {
      OR([
        { GATE: BACKTRACK(dA), ALT: () => CONSUME(DynA) },
        { ALT: () => CONSUME(DynB) },
      ]);
    },
  };

  it('covers CONSUME4-9 and SUBRULE5-9', ({ expect }) => {
    const parser = ParserBuilder.create(<const>[ dA, dB, dC, dD, dE, dConsume, dSubrule ])
      .build({ tokenVocabulary: dynVocab, lexerConfig: { ensureOptimizations: false }});
    expect(() => parser.dConsume('ABCDEF', {})).not.toThrow();
    expect(() => parser.dSubrule('ABCDE', {})).not.toThrow();
  });

  it('covers OPTION5-9, MANY5-9, MANY_SEP through MANY_SEP9', ({ expect }) => {
    const parser = ParserBuilder.create(<const>[ dOption, dMany, dManySep ])
      .build({ tokenVocabulary: dynVocab, lexerConfig: { ensureOptimizations: false }});
    expect(() => parser.dOption('', {})).not.toThrow();
    expect(() => parser.dMany('', {})).not.toThrow();
    expect(() => parser.dManySep('', {})).not.toThrow();
  });

  it('covers OR5 through OR9', ({ expect }) => {
    const parser = ParserBuilder.create(<const>[ dOr5, dOr6, dOr7, dOr8, dOr9 ])
      .build({ tokenVocabulary: dynVocab, lexerConfig: { ensureOptimizations: false }});
    expect(() => parser.dOr5('A', {})).not.toThrow();
    expect(() => parser.dOr6('C', {})).not.toThrow();
    expect(() => parser.dOr7('E', {})).not.toThrow();
    expect(() => parser.dOr8('G', {})).not.toThrow();
    expect(() => parser.dOr9('I', {})).not.toThrow();
  });

  it('covers AT_LEAST_ONE1-9 and AT_LEAST_ONE_SEP1-9', ({ expect }) => {
    const parser = ParserBuilder.create(<const>[ dAtLeastOne, dAtLeastOneSep ])
      .build({ tokenVocabulary: dynVocab, lexerConfig: { ensureOptimizations: false }});
    expect(() => parser.dAtLeastOne('ABCDEFGHI', {})).not.toThrow();
    expect(() => parser.dAtLeastOneSep('ABCDEFGHI', {})).not.toThrow();
  });

  it('covers BACKTRACK', ({ expect }) => {
    const parser = ParserBuilder.create(<const>[ dA, dBacktrack ])
      .build({ tokenVocabulary: dynVocab, lexerConfig: { ensureOptimizations: false }});
    expect(() => parser.dBacktrack('A', {})).not.toThrow();
    expect(() => parser.dBacktrack('B', {})).not.toThrow();
  });
});
