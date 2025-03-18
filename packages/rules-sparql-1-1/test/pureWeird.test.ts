/* eslint-disable require-unicode-regexp */
import type { ParserMethod } from 'chevrotain';
import { createToken, EmbeddedActionsParser, Lexer } from 'chevrotain';
import { describe, it } from 'vitest';

export const lexC = createToken({ name: 'lexC', pattern: /c/i, label: 'c' });
export const lexD = createToken({ name: 'lexD', pattern: /d/i, label: 'd' });
export const lexE = createToken({ name: 'lexE', pattern: /e/i, label: 'e' });
export const lexF = createToken({ name: 'lexF', pattern: /f/i, label: 'f' });
const allTokens = [ lexC, lexD, lexE, lexF ];

const lexer: Lexer = new Lexer(allTokens, {
  positionTracking: 'onlyStart',
  recoveryEnabled: false,
  safeMode: true,
});

class MyParser extends EmbeddedActionsParser {
  public readonly gramB: ParserMethod<Parameters<() => void>, ReturnType<() => 'gramB'>>;
  public readonly gramD: ParserMethod<Parameters<() => void>, ReturnType<() => 'gramD'>>;
  public readonly gramMain: ParserMethod<Parameters<() => void>, ReturnType<() => 'gramMain'>>;

  public constructor() {
    super(allTokens);

    this.gramD = this.RULE('gramD', () => {
      this.OPTION(() => this.CONSUME(lexD));
      return <const> 'gramD';
    });

    this.gramB = this.RULE('gramB', () => {
      this.CONSUME(lexC);
      this.MANY({
        // GATE: () => this.LA(2).tokenType === lexE || this.LA(3).tokenType === lexE,
        DEF: () => {
          this.CONSUME(lexE);
          this.SUBRULE(this.gramD, undefined);
        },
      });
      return <const> 'gramB';
    });

    this.gramMain = this.RULE('main', () => {
      this.SUBRULE(this.gramB, undefined);
      this.SUBRULE(this.gramD, undefined);
      this.CONSUME(lexF);
      return <const> 'gramMain';
    });

    this.performSelfAnalysis();
  }
}

describe('bugTest', () => {
  const parser = new MyParser();
  function parse(query: string): string {
    const tokens = lexer.tokenize(query);
    if (tokens.errors.length > 0) {
      throw new Error(tokens.errors[0].message);
    }
    parser.input = tokens.tokens;
    const res = parser.gramMain();
    if (parser.errors.length > 0) {
      console.log(tokens.tokens);
      throw new Error(`Parse error on line ${parser.errors.map(x => x.token.startLine).join(', ')}
${parser.errors.map(x => `${x.token.startLine}: ${x.message}`).join('\n')}
${parser.errors.map(x => x.stack).join('\n')}`);
    }
    return res;
  }

  it('bug recreation', ({ expect }) => {
    // WORKS: 'CF' and 'CDEF'
    // DOESN'T WORK, but should?: 'CDF' 'CDEDF'
    const res = parse(`CEDEF`);
    expect(res).toEqual('gramMain');
  });
});
