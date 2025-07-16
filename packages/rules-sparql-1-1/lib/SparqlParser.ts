import { Factory } from './factory';
import type { Path, TermIri } from './RoundTripTypes';
import type { SparqlContext } from './Sparql11types';

interface Parser<ParseRet> {
  queryOrUpdate: (input: string, context: SparqlContext, arg: undefined) => ParseRet;
  path: (input: string, context: SparqlContext, arg: undefined) => TermIri | Path;
}

export function completeParseContext(
  context: Partial<SparqlContext & { origSource: string; offset?: number }>,
): SparqlContext & { origSource: string; offset?: number } {
  return {
    factory: context.factory ?? new Factory(),
    baseIRI: context.baseIRI,
    prefixes: { ...context.prefixes },
    origSource: context.origSource ?? '',
    offset: context.offset,
    parseMode: context.parseMode ? new Set(context.parseMode) : new Set([ 'canParseVars', 'canCreateBlankNodes' ]),
    skipValidation: context.skipValidation ?? false,
  };
}

export class SparqlParser<ParseRet> {
  public constructor(private readonly parser: Parser<ParseRet>) {}
  private readonly F = new Factory();

  public parse(query: string, context: Partial<SparqlContext> = {}): ParseRet {
    return this.parser.queryOrUpdate(query, completeParseContext(context), undefined);
  }

  public parsePath(query: string, context: Partial<SparqlContext> = {}):
    (Path & { prefixes: object }) | TermIri {
    const result = this.parser.path(query, completeParseContext(context), undefined);
    if (this.F.isPathPure(result)) {
      return {
        ...result,
        prefixes: {},
      };
    }
    return result;
  }
}
