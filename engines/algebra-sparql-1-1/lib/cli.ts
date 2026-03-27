import type { Algebra, ContextConfigs } from '@traqula/algebra-transformations-1-1';
import { algebraUtils, createAlgebraContext, createAstContext } from '@traqula/algebra-transformations-1-1';
import type { SparqlQuery } from '@traqula/rules-sparql-1-1';
import { toAlgebra11Builder } from './toAlgebra.js';
import { toAst11Builder } from './toAst.js';

export type AlgebraCliRequest =
  | {
    readonly mode: 'toAlgebra';
    readonly input: SparqlQuery;
    readonly options?: ContextConfigs;
  }
  | {
    readonly mode: 'toAst';
    readonly input: Algebra.Operation;
    readonly options?: ContextConfigs;
  };

export interface AlgebraCliRuntime {
  readonly toAlgebraTransformer: ReturnType<typeof toAlgebra11Builder.build>;
  readonly toAstTransformer: ReturnType<typeof toAst11Builder.build>;
}

export function createAlgebraCliRuntime(): AlgebraCliRuntime {
  return {
    toAlgebraTransformer: toAlgebra11Builder.build(),
    toAstTransformer: toAst11Builder.build(),
  };
}

export function handleAlgebraCliRequest(runtime: AlgebraCliRuntime, request: AlgebraCliRequest): unknown {
  if (request.mode === 'toAlgebra') {
    const options = request.options ?? {};
    const context = createAlgebraContext(options);
    const operation = runtime.toAlgebraTransformer.translateQuery(
      context,
      request.input,
      options.quads,
      options.blankToVariable,
    );
    return algebraUtils.objectify(operation);
  }

  const context = createAstContext();
  return runtime.toAstTransformer.algToSparql(context, request.input);
}
