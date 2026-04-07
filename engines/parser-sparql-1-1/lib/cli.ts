import type { SparqlContext } from '@traqula/rules-sparql-1-1';
import { Parser } from './Parser.js';

export interface ParserCliRequest {
  readonly query: string;
  readonly path?: boolean;
  readonly context?: Partial<SparqlContext>;
}

export interface ParserCliRuntime {
  readonly parser: Parser;
  readonly defaultContext: Partial<SparqlContext>;
}

export function createParserCliRuntime(defaultContext: Partial<SparqlContext> = {}): ParserCliRuntime {
  return {
    parser: new Parser({ defaultContext }),
    defaultContext,
  };
}

export function handleParserCliRequest(runtime: ParserCliRuntime, request: ParserCliRequest): unknown {
  const context = mergeContext(runtime.defaultContext, request.context);
  return request.path ? runtime.parser.parsePath(request.query, context) : runtime.parser.parse(request.query, context);
}

function mergeContext(
  defaults: Partial<SparqlContext>,
  override: Partial<SparqlContext> | undefined,
): Partial<SparqlContext> {
  if (!override) {
    return defaults;
  }

  const parseMode = override.parseMode ?? defaults.parseMode;
  const merged: Partial<SparqlContext> = {
    ...defaults,
    ...override,
    prefixes: { ...defaults.prefixes, ...override.prefixes },
  };

  // Avoid setting parseMode to undefined: an explicit undefined overwrites the
  // parser's built-in default Set (canParseVars + canCreateBlankNodes) when the
  // partial context is spread inside Parser.parse / Parser.parsePath.
  if (parseMode === undefined) {
    delete merged.parseMode;
  } else {
    merged.parseMode = new Set(parseMode);
  }

  return merged;
}
