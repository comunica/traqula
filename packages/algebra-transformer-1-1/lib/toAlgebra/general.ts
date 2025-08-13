import type * as RDF from '@rdfjs/types';
import {

  findPatternBoundedVars,
} from '@traqula/rules-sparql-1-1';
import type {
  ContextDefinition,
  DatasetClauses,
  Path,
  PatternValues,
  SparqlQuery,
  Term,
  TripleCollection,
  TripleNesting,
  TermBlank,
  TermIri,
  TermLiteral,
  TermVariable,
} from '@traqula/rules-sparql-1-1';
import * as Algebra from '../algebra';
import type Factory from '../factory';
import Util from '../util';
import type { AlgebraContext } from './core';

type AstToRdfTerm<T extends Term> = T extends TermVariable ? RDF.Variable :
  T extends TermBlank ? RDF.BlankNode :
    T extends TermLiteral ? RDF.Literal :
      T extends TermIri ? RDF.NamedNode : never;

export function translateTerm<T extends Term>(c: AlgebraContext, term: T): AstToRdfTerm<T> {
  const F = c.astFactory;
  const dataFact = c.dataFactory;
  if (F.isTermNamed(term)) {
    let fullIri: string = term.value;
    if (F.isTermNamedPrefixed(term)) {
      const expanded = c.currentPrefixes[term.prefix];
      if (!expanded) {
        throw new Error(`Unknown prefix: ${term.prefix}`);
      }
      fullIri = expanded + term.value;
    }
    return <AstToRdfTerm<T>>dataFact.namedNode(Util.resolveIRI(fullIri, c.currentBase));
  }
  if (F.isTermBlank(term)) {
    return <AstToRdfTerm<T>>dataFact.blankNode(term.label);
  }
  if (F.isTermVariable(term)) {
    return <AstToRdfTerm<T>>dataFact.variable(term.value);
  }
  if (F.isTermLiteral(term)) {
    const langOrIri = typeof term.langOrIri === 'object' ? translateTerm(c, term.langOrIri) : term.langOrIri;
    return <AstToRdfTerm<T>>dataFact.literal(term.value, langOrIri);
  }
  throw new Error(`Unexpected term: ${JSON.stringify(term)}`);
}

export function registerContextDefinitions(c: AlgebraContext, definitions: ContextDefinition[]): void {
  const F = c.astFactory;
  for (const def of definitions) {
    if (F.isContextDefinitionPrefix(def)) {
      c.currentPrefixes[def.key] = translateTerm(c, def.value).value;
    }
    if (F.isContextDefinitionBase(def)) {
      c.currentBase = translateTerm(c, def.value).value;
    }
  }
}

export function translateInlineData(c: AlgebraContext, values: PatternValues): Algebra.Values {
  const variables = values.values.length === 0 ?
      [] :
    Object.keys(values.values[0]).map(key => c.dataFactory.variable(key));
  const bindings = values.values.map((binding) => {
    const map: Record<string, RDF.NamedNode | RDF.Literal> = {};
    for (const [ key, value ] of Object.entries(binding)) {
      if (value !== undefined) {
        map[key] = translateTerm(c, value);
      }
    }
    return map;
  });
  return c.factory.createValues(variables, bindings);
}

export function translateDatasetClause(c: AlgebraContext, dataset: DatasetClauses):
{ default: RDF.NamedNode[]; named: RDF.NamedNode[] } {
  return {
    default: dataset.clauses.filter(x => x.clauseType === 'default')
      .map(x => translateTerm(c, x.value)),
    named: dataset.clauses.filter(x => x.clauseType === 'named')
      .map(x => translateTerm(c, x.value)),
  };
}

export function translateBlankNodesToVariables(c: AlgebraContext, res: Algebra.Operation): Algebra.Operation {
  const factory = c.factory;
  const blankToVariableMapping: Record<string, RDF.Variable> = {};
  const variablesRaw: Set<string> = new Set(c.variables);

  return Util.mapOperation(res, {
    [Algebra.Types.DELETE_INSERT]: (op: Algebra.DeleteInsert) =>
      // Make sure blank nodes remain in the INSERT block, but do update the WHERE block
      ({
        result: factory.createDeleteInsert(
          op.delete,
          op.insert,
          op.where && translateBlankNodesToVariables(c, op.where),
        ),
        recurse: false,
      }),
    [Algebra.Types.PATH]: (op: Algebra.Path, factory: Factory) => ({
      result: factory.createPath(
        blankToVariable(op.subject),
        op.predicate,
        blankToVariable(op.object),
        blankToVariable(op.graph),
      ),
      recurse: false,
    }),
    [Algebra.Types.PATTERN]: (op: Algebra.Pattern, factory: Factory) => ({
      result: factory.createPattern(
        blankToVariable(op.subject),
        blankToVariable(op.predicate),
        blankToVariable(op.object),
        blankToVariable(op.graph),
      ),
      recurse: false,
    }),
    [Algebra.Types.CONSTRUCT]: (op: Algebra.Construct) =>
      // Blank nodes in CONSTRUCT templates must be maintained
      ({
        result: factory.createConstruct(translateBlankNodesToVariables(c, op.input), op.template),
        recurse: false,
      })
    ,
  });

  function blankToVariable(term: RDF.Term): RDF.Term {
    if (term.termType === 'BlankNode') {
      let variable = blankToVariableMapping[term.value];
      if (!variable) {
        variable = Util.createUniqueVariable(term.value, variablesRaw, factory.dataFactory);
        variablesRaw.add(variable.value);
        blankToVariableMapping[term.value] = variable;
      }
      return variable;
    }
    if (term.termType === 'Quad') {
      return factory.dataFactory.quad(
        blankToVariable(term.subject),
        blankToVariable(term.predicate),
        blankToVariable(term.object),
        blankToVariable(term.graph),
      );
    }
    return term;
  }
}

/**
 * Will be used to make sure new variables don't overlap
 */
export function findAllVariables(c: AlgebraContext, thingy: object): void {
  c.transformer.visitObjects(thingy, (current) => {
    if (c.astFactory.alwaysSparql11(current)) {
      if (c.astFactory.isTermVariable(current)) {
        c.variables.add(current.value);
      } else if (c.astFactory.isPatternValues(current)) {
        for (const key in current.values.at(0) ?? {}) {
          c.variables.add(key);
        }
      }
    }
  });
}

/**
 * 18.2.1
 */
export function inScopeVariables(thingy: SparqlQuery | TripleNesting | TripleCollection | Path | Term): Set<string> {
  const vars = new Set<string>();
  findPatternBoundedVars(thingy, vars);
  return vars;
}

export function generateFreshVar(c: AlgebraContext): RDF.Variable {
  let newVar = `var${c.varCount++}`;
  while (c.variables.has(newVar)) {
    newVar = `var${c.varCount++}`;
  }
  c.variables.add(newVar);
  return c.dataFactory.variable(newVar);
}
