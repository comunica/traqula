import type { SparqlGeneratorContext, Path, Query, Update } from '@traqula/rules-sparql-1-1';
import { Generator } from './index.js';

export interface GeneratorCliRequest {
  readonly ast: Query | Update | Path;
  readonly path?: boolean;
  readonly context?: Partial<SparqlGeneratorContext>;
}

export interface GeneratorCliRuntime {
  readonly generator: Generator;
  readonly defaultContext: Partial<SparqlGeneratorContext>;
}

export function createGeneratorCliRuntime(defaultContext: Partial<SparqlGeneratorContext> = {}): GeneratorCliRuntime {
  return {
    generator: new Generator(defaultContext),
    defaultContext,
  };
}

export function handleGeneratorCliRequest(runtime: GeneratorCliRuntime, request: GeneratorCliRequest): string {
  const context = mergeContext(runtime.defaultContext, request.context);
  return request.path ?
    runtime.generator.generatePath(request.ast as Path, context) :
    runtime.generator.generate(request.ast as Query | Update, context);
}

function mergeContext(
  defaults: Partial<SparqlGeneratorContext>,
  override: Partial<SparqlGeneratorContext> | undefined,
): Partial<SparqlGeneratorContext> {
  if (!override) {
    return defaults;
  }
  return {
    ...defaults,
    ...override,
  };
}
