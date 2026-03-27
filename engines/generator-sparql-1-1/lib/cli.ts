import type { SparqlGeneratorContext, Path, Query, Update } from '@traqula/rules-sparql-1-1';
import { Generator } from './index.js';

export type GeneratorCliRequest =
  | {
    readonly ast: Path;
    readonly path: true;
    readonly context?: Partial<SparqlGeneratorContext>;
  }
  | {
    readonly ast: Query | Update;
    readonly path?: false;
    readonly context?: Partial<SparqlGeneratorContext>;
  };

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
    runtime.generator.generatePath(request.ast, context) :
    runtime.generator.generate(request.ast, context);
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
