/**
 * Tests that exercise the high-numbered Chevrotain method variants in
 * DynamicParser (CONSUME4-9, OPTION5-9, OR5-9, MANY5-9, MANY_SEP0-9,
 * AT_LEAST_ONE1-9, AT_LEAST_ONE_SEP1-9, SUBRULE5-9, BACKTRACK).
 *
 * These are defined in constructSelfRef() and are only covered when a grammar
 * rule actually calls those particular numbered variants.
 */
import { ParserBuilder, createToken } from '@traqula/core';
import type { ParserRule } from '@traqula/core';
import { describe, it } from 'vitest';

// ---------------------------------------------------------------------------
// Token definitions
// ---------------------------------------------------------------------------
const A = createToken({ name: 'A', pattern: /a/u });
const B = createToken({ name: 'B', pattern: /b/u });
const C = createToken({ name: 'C', pattern: /c/u });
const D = createToken({ name: 'D', pattern: /d/u });
const E = createToken({ name: 'E', pattern: /e/u });
const F = createToken({ name: 'F', pattern: /f/u });
const G = createToken({ name: 'G', pattern: /g/u });
const H = createToken({ name: 'H', pattern: /h/u });
const I = createToken({ name: 'I', pattern: /i/u });
const J = createToken({ name: 'J', pattern: /j/u });
const K = createToken({ name: 'K', pattern: /k/u });
const COMMA = createToken({ name: 'COMMA', pattern: /,/u });
const SEMI = createToken({ name: 'SEMI', pattern: /;/u });
const WS = createToken({ name: 'WS', pattern: /\s+/u, group: 'SKIPPED' });

const ALL_TOKENS = [ A, B, C, D, E, F, G, H, I, J, K, COMMA, SEMI, WS ];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildAndRun(rules: ParserRule<Record<string, never>, any, any, any>[], input: string, startRule: string): any {
  const parser = ParserBuilder.create(rules).build({
    tokenVocabulary: ALL_TOKENS,
    lexerConfig: { ensureOptimizations: false },
  });
  return (<any>parser)[startRule](input, {});
}

describe('dynamicParser – CONSUME', () => {
  const tenConsumeRule: ParserRule<Record<string, never>, 'tenConsume', string[], []> = {
    name: 'tenConsume',
    impl: ({ CONSUME, CONSUME1, CONSUME2, CONSUME3, CONSUME4, CONSUME5, CONSUME6, CONSUME7, CONSUME8, CONSUME9 }) =>
      () => [
        CONSUME(A).image,
        CONSUME1(B).image,
        CONSUME2(C).image,
        CONSUME3(D).image,
        CONSUME4(E).image,
        CONSUME5(F).image,
        CONSUME6(G).image,
        CONSUME7(H).image,
        CONSUME8(I).image,
        CONSUME9(J).image,
      ],
  };

  it('covers CONSUME variants', ({ expect }) => {
    const result = buildAndRun([ tenConsumeRule ], 'a b c d e f g h i j', 'tenConsume');
    expect(result).toEqual([ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j' ]);
  });
});

// ---------------------------------------------------------------------------
// OPTION5-9
// ---------------------------------------------------------------------------
describe('dynamicParser – OPTION', () => {
  // Each OPTION variant tries to consume a token; with empty input none fire.
  const tenOptionRule: ParserRule<Record<string, never>, 'tenOption', number, []> = {
    name: 'tenOption',
    impl: ({
      CONSUME,
      CONSUME1,
      CONSUME2,
      CONSUME3,
      CONSUME4,
      CONSUME5,
      CONSUME6,
      CONSUME7,
      CONSUME8,
      CONSUME9,
      OPTION,
      OPTION1,
      OPTION2,
      OPTION3,
      OPTION4,
      OPTION5,
      OPTION6,
      OPTION7,
      OPTION8,
      OPTION9,
    }) =>
      () => {
        let count = 0;
        OPTION(() => {
          CONSUME(A);
          count++;
        });
        OPTION1(() => {
          CONSUME1(B);
          count++;
        });
        OPTION2(() => {
          CONSUME2(C);
          count++;
        });
        OPTION3(() => {
          CONSUME3(D);
          count++;
        });
        OPTION4(() => {
          CONSUME4(E);
          count++;
        });
        OPTION5(() => {
          CONSUME5(F);
          count++;
        });
        OPTION6(() => {
          CONSUME6(G);
          count++;
        });
        OPTION7(() => {
          CONSUME7(H);
          count++;
        });
        OPTION8(() => {
          CONSUME8(I);
          count++;
        });
        OPTION9(() => {
          CONSUME9(J);
          count++;
        });
        return count;
      },
  };

  it('covers OPTION ariants with no matching tokens (count=0)', ({ expect }) => {
    const result = buildAndRun([ tenOptionRule ], '', 'tenOption');
    expect(result).toBe(0);
  });

  it('covers OPTION variants with all matching tokens (count=10)', ({ expect }) => {
    const result = buildAndRun([ tenOptionRule ], 'a b c d e f g h i j', 'tenOption');
    expect(result).toBe(10);
  });
});

describe('dynamicParser – OR', () => {
  const tenOrRule: ParserRule<Record<string, never>, 'tenOr', string, []> = {
    name: 'tenOr',
    impl: ({ CONSUME, OR, OR1, OR2, OR3, OR4, OR5, OR6, OR7, OR8, OR9 }) =>
      () =>
        OR([
          { ALT: () => OR1([{ ALT: () => OR2([{ ALT: () =>
            OR3([{ ALT: () => OR4([{ ALT: () =>
              OR5([{ ALT: () => OR6([{ ALT: () =>
                OR7([{ ALT: () => OR8([{ ALT: () =>
                  OR9([{ ALT: () => CONSUME(A).image }]),
                }]) }]) }]) }]) }]) }]) }]) }]) },
        ]),
  };

  it('covers OR variants', ({ expect }) => {
    const result = buildAndRun([ tenOrRule ], 'a', 'tenOr');
    expect(result).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// MANY5-9
// ---------------------------------------------------------------------------
describe('dynamicParser – MANY', () => {
  const tenManyRule: ParserRule<Record<string, never>, 'tenMany', number, []> = {
    name: 'tenMany',
    impl: ({
      CONSUME,
      CONSUME1,
      CONSUME2,
      CONSUME3,
      CONSUME4,
      CONSUME5,
      CONSUME6,
      CONSUME7,
      CONSUME8,
      CONSUME9,
      MANY,
      MANY1,
      MANY2,
      MANY3,
      MANY4,
      MANY5,
      MANY6,
      MANY7,
      MANY8,
      MANY9,
    }) =>
      () => {
        let count = 0;
        MANY(() => {
          CONSUME(A);
          count++;
        });
        MANY1(() => {
          CONSUME1(B);
          count++;
        });
        MANY2(() => {
          CONSUME2(C);
          count++;
        });
        MANY3(() => {
          CONSUME3(D);
          count++;
        });
        MANY4(() => {
          CONSUME4(E);
          count++;
        });
        MANY5(() => {
          CONSUME5(F);
          count++;
        });
        MANY6(() => {
          CONSUME6(G);
          count++;
        });
        MANY7(() => {
          CONSUME7(H);
          count++;
        });
        MANY8(() => {
          CONSUME8(I);
          count++;
        });
        MANY9(() => {
          CONSUME9(J);
          count++;
        });
        return count;
      },
  };

  it('covers MANY variants with no input (count=0)', ({ expect }) => {
    const result = buildAndRun([ tenManyRule ], '', 'tenMany');
    expect(result).toBe(0);
  });

  it('covers MANY variants with full input', ({ expect }) => {
    const result = buildAndRun([ tenManyRule ], 'a b c d e f g h i j', 'tenMany');
    expect(result).toBe(10);
  });
});

describe('dynamicParser – MANY_SEP0-9', () => {
  const tenManySepRule: ParserRule<Record<string, never>, 'tenManySep', number, []> = {
    name: 'tenManySep',
    impl: ({
      CONSUME,
      CONSUME1,
      CONSUME2,
      CONSUME3,
      CONSUME4,
      CONSUME5,
      CONSUME6,
      CONSUME7,
      CONSUME8,
      CONSUME9,
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
    }) =>
      () => {
        let count = 0;
        MANY_SEP({ SEP: COMMA, DEF: () => {
          CONSUME(A);
          count++;
        } });
        MANY_SEP1({ SEP: COMMA, DEF: () => {
          CONSUME1(B);
          count++;
        } });
        MANY_SEP2({ SEP: COMMA, DEF: () => {
          CONSUME2(C);
          count++;
        } });
        MANY_SEP3({ SEP: COMMA, DEF: () => {
          CONSUME3(D);
          count++;
        } });
        MANY_SEP4({ SEP: COMMA, DEF: () => {
          CONSUME4(E);
          count++;
        } });
        MANY_SEP5({ SEP: COMMA, DEF: () => {
          CONSUME5(F);
          count++;
        } });
        MANY_SEP6({ SEP: COMMA, DEF: () => {
          CONSUME6(G);
          count++;
        } });
        MANY_SEP7({ SEP: COMMA, DEF: () => {
          CONSUME7(H);
          count++;
        } });
        MANY_SEP8({ SEP: COMMA, DEF: () => {
          CONSUME8(I);
          count++;
        } });
        MANY_SEP9({ SEP: COMMA, DEF: () => {
          CONSUME9(J);
          count++;
        } });
        return count;
      },
  };

  it('covers MANY_SEP variants with no input (count=0)', ({ expect }) => {
    const result = buildAndRun([ tenManySepRule ], '', 'tenManySep');
    expect(result).toBe(0);
  });
});

describe('dynamicParser – AT_LEAST_ONE1-9', () => {
  const nineAtLeastOneRule: ParserRule<Record<string, never>, 'nineAtLeastOne', number, []> = {
    name: 'nineAtLeastOne',
    impl: ({
      CONSUME,
      CONSUME1,
      CONSUME2,
      CONSUME3,
      CONSUME4,
      CONSUME5,
      CONSUME6,
      CONSUME7,
      CONSUME8,
      CONSUME9,
      AT_LEAST_ONE,
      AT_LEAST_ONE1,
      AT_LEAST_ONE2,
      AT_LEAST_ONE3,
      AT_LEAST_ONE4,
      AT_LEAST_ONE5,
      AT_LEAST_ONE6,
      AT_LEAST_ONE7,
      AT_LEAST_ONE8,
      AT_LEAST_ONE9,
    }) =>
      () => {
        let count = 0;
        AT_LEAST_ONE(() => {
          CONSUME(A);
          count++;
        });
        AT_LEAST_ONE1(() => {
          CONSUME1(B);
          count++;
        });
        AT_LEAST_ONE2(() => {
          CONSUME2(C);
          count++;
        });
        AT_LEAST_ONE3(() => {
          CONSUME3(D);
          count++;
        });
        AT_LEAST_ONE4(() => {
          CONSUME4(E);
          count++;
        });
        AT_LEAST_ONE5(() => {
          CONSUME5(F);
          count++;
        });
        AT_LEAST_ONE6(() => {
          CONSUME6(G);
          count++;
        });
        AT_LEAST_ONE7(() => {
          CONSUME7(H);
          count++;
        });
        AT_LEAST_ONE8(() => {
          CONSUME8(I);
          count++;
        });
        AT_LEAST_ONE9(() => {
          CONSUME9(J);
          count++;
        });
        return count;
      },
  };

  it('covers AT_LEAST_ONE1-9 variants', ({ expect }) => {
    const result = buildAndRun([ nineAtLeastOneRule ], 'a b c d e f g h i j', 'nineAtLeastOne');
    expect(result).toBe(10);
  });
});

describe('dynamicParser – AT_LEAST_ONE_SEP1-9', () => {
  const nineAtLeastOneSepRule: ParserRule<Record<string, never>, 'nineAtLeastOneSep', number, []> = {
    name: 'nineAtLeastOneSep',
    impl: ({
      CONSUME,
      AT_LEAST_ONE_SEP,
      AT_LEAST_ONE_SEP1,
      AT_LEAST_ONE_SEP2,
      AT_LEAST_ONE_SEP3,
      AT_LEAST_ONE_SEP4,
      AT_LEAST_ONE_SEP5,
      AT_LEAST_ONE_SEP6,
      AT_LEAST_ONE_SEP7,
      AT_LEAST_ONE_SEP8,
      AT_LEAST_ONE_SEP9,
    }) =>
      () => {
        let count = 0;
        AT_LEAST_ONE_SEP({ SEP: COMMA, DEF: () => {
          CONSUME(A);
          count++;
        } });
        AT_LEAST_ONE_SEP1({ SEP: COMMA, DEF: () => {
          count++;
        } });
        AT_LEAST_ONE_SEP2({ SEP: COMMA, DEF: () => {
          count++;
        } });
        AT_LEAST_ONE_SEP3({ SEP: COMMA, DEF: () => {
          count++;
        } });
        AT_LEAST_ONE_SEP4({ SEP: COMMA, DEF: () => {
          count++;
        } });
        AT_LEAST_ONE_SEP5({ SEP: COMMA, DEF: () => {
          count++;
        } });
        AT_LEAST_ONE_SEP6({ SEP: COMMA, DEF: () => {
          count++;
        } });
        AT_LEAST_ONE_SEP7({ SEP: COMMA, DEF: () => {
          count++;
        } });
        AT_LEAST_ONE_SEP8({ SEP: COMMA, DEF: () => {
          count++;
        } });
        AT_LEAST_ONE_SEP9({ SEP: COMMA, DEF: () => {
          count++;
        } });
        return count;
      },
  };

  it('covers AT_LEAST_ONE_SEP1-9 variants', ({ expect }) => {
    const result = buildAndRun([ nineAtLeastOneSepRule ], 'a', 'nineAtLeastOneSep');
    expect(result).toBeGreaterThanOrEqual(9);
  });
});

describe('dynamicParser – BACKTRACK', () => {
  // A rule that uses BACKTRACK to distinguish two alternatives
  const ruleA: ParserRule<Record<string, never>, 'ruleA', string, []> = {
    name: 'ruleA',
    impl: ({ CONSUME }) => () => CONSUME(A).image,
  };

  const withBacktrack: ParserRule<Record<string, never>, 'withBacktrack', string, []> = {
    name: 'withBacktrack',
    impl: ({ CONSUME, BACKTRACK, OR }) => () =>
      OR([
        {
          GATE: BACKTRACK(ruleA),
          ALT: () => CONSUME(A).image,
        },
        { ALT: () => CONSUME(B).image },
      ]),
  };

  it('covers BACKTRACK variant', ({ expect }) => {
    const result = buildAndRun([ ruleA, withBacktrack ], 'a', 'withBacktrack');
    expect(result).toBe('a');
  });
});

describe('dynamicParser – SUBRULE5-9', () => {
  const innerRule: ParserRule<Record<string, never>, 'inner', string, []> = {
    name: 'inner',
    impl: ({ CONSUME }) => () => CONSUME(A).image,
  };

  const fiveSubruleRule: ParserRule<Record<string, never>, 'fiveSubrule', string[], []> = {
    name: 'fiveSubrule',
    impl: ({ SUBRULE, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, SUBRULE5, SUBRULE6, SUBRULE7, SUBRULE8, SUBRULE9 }) =>
      () => [
        SUBRULE(innerRule),
        SUBRULE1(innerRule),
        SUBRULE2(innerRule),
        SUBRULE3(innerRule),
        SUBRULE4(innerRule),
        SUBRULE5(innerRule),
        SUBRULE6(innerRule),
        SUBRULE7(innerRule),
        SUBRULE8(innerRule),
        SUBRULE9(innerRule),
      ],
  };

  it('covers SUBRULE5-9 variants', ({ expect }) => {
    const result = buildAndRun([ innerRule, fiveSubruleRule ], 'a a a a a a a a a a', 'fiveSubrule');
    expect(result).toEqual([ 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a' ]);
  });
});
