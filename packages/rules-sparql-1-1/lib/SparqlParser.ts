import { DataFactory } from 'rdf-data-factory';
import type { IriTerm, PropertyPath, SparqlContext } from './Sparql11types';

interface Parser<ParseRet> {
  queryOrUpdate: (input: string, context: SparqlContext, arg: undefined) => ParseRet;
  path: (input: string, context: SparqlContext, arg: undefined) => IriTerm | PropertyPath;
}

function completeParseContext(context: Partial<SparqlContext>): SparqlContext {
  return {
    factory: context.factory ?? new DataFactory({ blankNodePrefix: 'g_' }),
    baseIRI: context.baseIRI,
    prefixes: { ...context.prefixes },
    parseMode: context.parseMode ? new Set(context.parseMode) : new Set([ 'canParseVars', 'canCreateBlankNodes' ]),
    skipValidation: context.skipValidation ?? false,
  };
}

export class SparqlParser<ParseRet> {
  public constructor(private readonly parser: Parser<ParseRet>) {}

  public parse(query: string, context: Partial<SparqlContext> = {}): ParseRet {
    return this.parser.queryOrUpdate(query, completeParseContext(context), undefined);
  }

  public parsePath(query: string, context: Partial<SparqlContext> = {}):
    (PropertyPath & { prefixes: object }) | IriTerm {
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
