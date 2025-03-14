import { TraqulaFactory } from './factory';
import type { Path, TermIri } from './RoundTripTypes';
import type { SparqlContext } from './Sparql11types';

interface Parser<ParseRet> {
  query: (input: string, context: SparqlContext, arg: undefined) => ParseRet;
  path: (input: string, context: SparqlContext, arg: undefined) => TermIri | Path;
}

function completeParseContext(context: Partial<SparqlContext>): SparqlContext {
  return {
    factory: context.factory ?? new TraqulaFactory(),
    baseIRI: context.baseIRI,
    prefixes: { ...context.prefixes },
    parseMode: context.parseMode ? new Set(context.parseMode) : new Set([ 'canParseVars', 'canCreateBlankNodes' ]),
    skipValidation: context.skipValidation ?? false,
  };
}

export class SparqlParser<ParseRet> {
  public constructor(private readonly parser: Parser<ParseRet>) {}

  public parse(query: string, context: Partial<SparqlContext> = {}): ParseRet {
    return this.parser.query(query, completeParseContext(context), undefined);
  }

  public parsePath(query: string, context: Partial<SparqlContext> = {}):
    (Path & { prefixes: object }) | TermIri {
    const result = this.parser.path(query, completeParseContext(context), undefined);
    if ('type' in result) {
      return {
        ...result,
        prefixes: {},
      };
    }
    return result;
  }
}
