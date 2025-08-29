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
  TermIri,
  TermBlank,
  TermLiteral,
  TermVariable,
} from '@traqula/rules-sparql-1-1';
import * as Algebra from '../algebra';
import type { Factory } from '../factory';
import * as util from '../util';
import type { AlgebraIndir } from './core';

export const translateNamed: AlgebraIndir<'translateNamed', RDF.NamedNode, [TermIri]> = {
  name: 'translateNamed',
  fun: () => ({ astFactory: F, currentPrefixes, currentBase, dataFactory }, term) => {
    let fullIri: string = term.value;
    if (F.isTermNamedPrefixed(term)) {
      const expanded = currentPrefixes[term.prefix];
      if (!expanded) {
        throw new Error(`Unknown prefix: ${term.prefix}`);
      }
      fullIri = expanded + term.value;
    }
    return dataFactory.namedNode(util.resolveIRI(fullIri, currentBase));
  },
};

export type AstToRdfTerm<T extends Term> = T extends TermVariable ? RDF.Variable :
  T extends TermBlank ? RDF.BlankNode :
    T extends TermLiteral ? RDF.Literal :
      T extends TermIri ? RDF.NamedNode : never;

export const translateTerm: AlgebraIndir<'translateTerm', RDF.Term, [Term]> = {
  name: 'translateTerm',
  fun: ({ SUBRULE }) => ({ astFactory: F, dataFactory }, term) => {
    if (F.isTermNamed(term)) {
      return SUBRULE(translateNamed, term);
    }
    if (F.isTermBlank(term)) {
      return dataFactory.blankNode(term.label);
    }
    if (F.isTermVariable(term)) {
      return dataFactory.variable(term.value);
    }
    if (F.isTermLiteral(term)) {
      const langOrIri = typeof term.langOrIri === 'object' ?
        SUBRULE(translateNamed, term.langOrIri) :
        term.langOrIri;
      return dataFactory.literal(term.value, langOrIri);
    }
    throw new Error(`Unexpected term: ${JSON.stringify(term)}`);
  },
};

export const registerContextDefinitions: AlgebraIndir<'registerContextDefinitions', void, [ContextDefinition[]]> = {
  name: 'registerContextDefinitions',
  fun: ({ SUBRULE }) => (c, definitions) => {
    const { astFactory: F, currentPrefixes } = c;
    for (const def of definitions) {
      if (F.isContextDefinitionPrefix(def)) {
        currentPrefixes[def.key] = SUBRULE(translateTerm, def.value).value;
      }
      if (F.isContextDefinitionBase(def)) {
        c.currentBase = SUBRULE(translateTerm, def.value).value;
      }
    }
  },
};

export const translateInlineData: AlgebraIndir<'translateInlineData', Algebra.Values, [PatternValues]> = {
  name: 'translateInlineData',
  fun: ({ SUBRULE }) => ({ factory, dataFactory }, values) => {
    const variables = values.values.length === 0 ?
        [] :
      Object.keys(values.values[0]).map(key => dataFactory.variable(key));
    const bindings = values.values.map((binding) => {
      const map: Record<string, RDF.NamedNode | RDF.Literal> = {};
      for (const [ key, value ] of Object.entries(binding)) {
        if (value !== undefined) {
          map[key] = <RDF.NamedNode | RDF.Literal> SUBRULE(translateTerm, value);
        }
      }
      return map;
    });
    return factory.createValues(variables, bindings);
  },
};

export const translateDatasetClause:
AlgebraIndir<'translateDatasetClause', { default: RDF.NamedNode[]; named: RDF.NamedNode[] }, [DatasetClauses]> = {
  name: 'translateDatasetClause',
  fun: ({ SUBRULE }) => (_, dataset) => ({
    default: dataset.clauses.filter(x => x.clauseType === 'default')
      .map(x => SUBRULE(translateNamed, x.value)),
    named: dataset.clauses.filter(x => x.clauseType === 'named')
      .map(x => SUBRULE(translateNamed, x.value)),
  }),
};

export const translateBlankNodesToVariables:
AlgebraIndir<'translateBlankNodesToVariables', Algebra.Operation, [Algebra.Operation]> = {
  name: 'translateBlankNodesToVariables',
  fun: ({ SUBRULE }) => ({ factory, variables }, res) => {
    const blankToVariableMapping: Record<string, RDF.Variable> = {};
    const variablesRaw: Set<string> = new Set(variables);

    return util.mapOperation(res, {
      [Algebra.Types.DELETE_INSERT]: (op: Algebra.DeleteInsert) =>
        // Make sure blank nodes remain in the INSERT block, but do update the WHERE block
        ({
          result: factory.createDeleteInsert(
            op.delete,
            op.insert,
            op.where && SUBRULE(translateBlankNodesToVariables, op.where),
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
          result: factory.createConstruct(SUBRULE(translateBlankNodesToVariables, op.input), op.template),
          recurse: false,
        })
      ,
    });

    function blankToVariable(term: RDF.Term): RDF.Term {
      if (term.termType === 'BlankNode') {
        let variable = blankToVariableMapping[term.value];
        if (!variable) {
          variable = util.createUniqueVariable(term.value, variablesRaw, factory.dataFactory);
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
  },
};

/**
 * Will be used to make sure new variables don't overlap
 */
export const findAllVariables: AlgebraIndir<'findAllVariables', void, [object]> = {
  name: 'findAllVariables',
  fun: () => ({ transformer, astFactory: F, variables }, thingy) => {
    transformer.visitObjects(thingy, (current) => {
      if (F.alwaysSparql11(current)) {
        if (F.isTermVariable(current)) {
          variables.add(current.value);
        } else if (F.isPatternValues(current)) {
          for (const key in current.values.at(0) ?? {}) {
            variables.add(key);
          }
        }
      }
    });
  },
};

/**
 * 18.2.1
 */
export function inScopeVariables(thingy: SparqlQuery | TripleNesting | TripleCollection | Path | Term): Set<string> {
  const vars = new Set<string>();
  findPatternBoundedVars(thingy, vars);
  return vars;
}

export const generateFreshVar: AlgebraIndir<'generateFreshVar', RDF.Variable, []> = {
  name: 'generateFreshVar',
  fun: () => (c) => {
    let newVar = `var${c.varCount++}`;
    while (c.variables.has(newVar)) {
      newVar = `var${c.varCount++}`;
    }
    c.variables.add(newVar);
    return c.dataFactory.variable(newVar);
  },
};
