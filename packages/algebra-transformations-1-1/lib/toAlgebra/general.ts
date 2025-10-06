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
import * as Algebra from '../algebra.js';
import { AlgebraFactory } from '../algebraFactory.js';
import { asKnown } from '../openAlgebra.js';
import * as util from '../util.js';
import type { AlgebraIndir } from './core.js';

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
  fun: ({ SUBRULE }) => ({ algebraFactory: AF, dataFactory: DF }, values) => {
    const variables = values.values.length === 0 ?
        [] :
      Object.keys(values.values[0]).map(key => DF.variable(key));
    const bindings = values.values.map((binding) => {
      const map: Record<string, RDF.NamedNode | RDF.Literal> = {};
      for (const [ key, value ] of Object.entries(binding)) {
        if (value !== undefined) {
          map[key] = <RDF.NamedNode | RDF.Literal> SUBRULE(translateTerm, value);
        }
      }
      return map;
    });
    return AF.createValues(variables, bindings);
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
  fun: ({ SUBRULE }) => ({ algebraFactory: AF, variables }, res) => {
    const blankToVariableMapping: Record<string, RDF.Variable> = {};
    const variablesRaw: Set<string> = new Set(variables);
    const factory = new AlgebraFactory();

    return Algebra.mapOperationReplace<'unsafe', typeof res>(res, {
      [Algebra.Types.PATH]: {
        preVisitor: () => ({ continue: false }),
        transform: op => factory.createPath(
          blankToVariable(op.subject),
          op.predicate,
          blankToVariable(op.object),
          blankToVariable(op.graph),
        ),
      },
      [Algebra.Types.PATTERN]: {
        preVisitor: () => ({ continue: false }),
        transform: op => factory.createPattern(
          blankToVariable(op.subject),
          blankToVariable(op.predicate),
          blankToVariable(op.object),
          blankToVariable(op.graph),
        ),
      },
      [Algebra.Types.CONSTRUCT]: {
        preVisitor: () => ({ continue: false }),
        // Blank nodes in CONSTRUCT templates must be maintained
        transform: op => AF.createConstruct(SUBRULE(translateBlankNodesToVariables, asKnown(op.input)), op.template),
      },
      [Algebra.Types.UPDATE]: {
        preVisitor: () => ({ continue: false }),
        transform: (op: Algebra.Update) => {
          // Make sure blank nodes remain in the INSERT block, but do update the WHERE block
          if (op.subType === Algebra.UpdateTypes.DELETE_INSERT) {
            return AF.createDeleteInsert(
              op.delete,
              op.insert,
              op.where && SUBRULE(translateBlankNodesToVariables, op.where),
            );
          }
          return op;
        },
      },
    });

    function blankToVariable(term: RDF.Term): RDF.Term {
      if (term.termType === 'BlankNode') {
        let variable = blankToVariableMapping[term.value];
        if (!variable) {
          variable = util.createUniqueVariable(term.value, variablesRaw, AF.dataFactory);
          variablesRaw.add(variable.value);
          blankToVariableMapping[term.value] = variable;
        }
        return variable;
      }
      if (term.termType === 'Quad') {
        return AF.dataFactory.quad(
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
  fun: () => ({ transformer, variables }, thingy) => {
    transformer.visitNodeSpecific(
      thingy,
      {},
      {
        term: { variable: { visitor: (_var) => {
          variables.add(_var.value);
        } }},
        pattern: { values: { visitor: (values) => {
          for (const key in values.values.at(0) ?? {}) {
            variables.add(key);
          }
        } }},
      },
    );
  },
};

/**
 * 18.2.1
 */
export const inScopeVariables:
AlgebraIndir<'inScopeVariables', Set<string>, [SparqlQuery | TripleNesting | TripleCollection | Path | Term]> = {
  name: 'inScopeVariables',
  fun: () => (_, thingy) => {
    const vars = new Set<string>();
    findPatternBoundedVars(thingy, vars);
    return vars;
  },
};

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
