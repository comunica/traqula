import type * as RDF from '@rdfjs/types';
import type {
  DatasetClauses,
  Pattern,
  PatternGroup,
  QuerySelect,
  Term,
  TermBlank,
  TermIri,
  TermLiteral,
  TermVariable,
  TripleNesting,
} from '@traqula/rules-sparql-1-1';
import type { Algebra } from '../index';
import Util from '../util';
import type { AstIndir } from './core';
import { translatePureExpression } from './expression';
import { translatePatternIntoGroup, translatePatternNew } from './pattern';

export type RdfTermToAst<T extends RDF.Term> = T extends RDF.Variable ? TermVariable :
  T extends RDF.BlankNode ? TermBlank :
    T extends RDF.Literal ? TermLiteral :
      T extends RDF.NamedNode ? TermIri : never;

export const translateTerm: AstIndir<'translateTerm', Term, [RDF.Term]> = {
  name: 'translateTerm',
  fun: ({ SUBRULE }) => ({ astFactory: F }, term) => {
    if (term.termType === 'NamedNode') {
      return F.namedNode(F.gen(), term.value);
    }
    if (term.termType === 'BlankNode') {
      return F.blankNode(term.value, F.gen());
    }
    if (term.termType === 'Variable') {
      return F.variable(term.value, F.gen());
    }
    if (term.termType === 'Literal') {
      return F.literalTerm(
        F.gen(),
        term.value,
        term.language ? term.language : <RdfTermToAst<typeof term.datatype>>SUBRULE(translateTerm, term.datatype),
      );
    }
    throw new Error(`invalid term type: ${term.termType}`);
  },
};

/**
 * Extend is for example a bind, or an aggregator.
 * The result is thus registered to be tackled at the project level,
 *  or if we are not in project scope, we give it as a patternBind
 *  - of course, the pattern bind is scoped with the other operations at this level
 */
export const translateExtend: AstIndir<'translateExtend', Pattern | Pattern[], [Algebra.Extend]> = {
  name: 'translateExtend',
  fun: ({ SUBRULE }) => ({ astFactory: F, project, extend }, op) => {
    if (project) {
      extend.push(op);
      return SUBRULE(translatePatternNew, op.input);
    }
    return Util.flatten([
      SUBRULE(translatePatternNew, op.input),
      F.patternBind(
        SUBRULE(translatePureExpression, op.expression),
        <RdfTermToAst<typeof op.variable>> SUBRULE(translateTerm, op.variable),
        F.gen(),
      ),
    ]);
  },
};

export const translateDatasetClauses:
AstIndir<'translateDatasetClauses', DatasetClauses, [RDF.NamedNode[], RDF.NamedNode[]]> = {
  name: 'translateDatasetClauses',
  fun: ({ SUBRULE }) => ({ astFactory: F }, _default, named) =>
    F.datasetClauses([
      ..._default.map(x => (<const>{
        clauseType: 'default',
        value: <RdfTermToAst<typeof x>> SUBRULE(translateTerm, x),
      })),
      ...named.map(x => (<const>{
        clauseType: 'named',
        value: <RdfTermToAst<typeof x>>SUBRULE(translateTerm, x),
      })),
    ], F.gen()),
};

/**
 * An order by is just registered to be handled in the creation of your QueryBase
 */
export const translateOrderBy: AstIndir<'translateOrderBy', Pattern | Pattern[], [Algebra.OrderBy]> = {
  name: 'translateOrderBy',
  fun: ({ SUBRULE }) => ({ order }, op) => {
    order.push(...op.expressions);
    return SUBRULE(translatePatternNew, op.input);
  },
};

export const translatePattern: AstIndir<'translatePattern', TripleNesting, [Algebra.Pattern]> = {
  name: 'translatePattern',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.triple(
      SUBRULE(translateTerm, op.subject),
      <TripleNesting['predicate']> SUBRULE(translateTerm, op.predicate),
      SUBRULE(translateTerm, op.object),
    ),
};

/**
 * Reduced is wrapped around a project, set the query contained to be distinct
 */
export const translateReduced: AstIndir<'translateReduced', PatternGroup, [Algebra.Reduced]> = {
  name: 'translateReduced',
  fun: ({ SUBRULE }) => (_, op) => {
    const result = SUBRULE(translatePatternIntoGroup, op.input);
    const select = <QuerySelect>result.patterns[0];
    select.reduced = true;
    return result;
  },
};

/**
 * District is wrapped around a project, set the query contained to be distinct
 */
export const translateDistinct: AstIndir<'translateDistinct', PatternGroup, [Algebra.Distinct]> = {
  name: 'translateDistinct',
  fun: ({ SUBRULE }) => (_, op) => {
    const result = SUBRULE(translatePatternIntoGroup, op.input);
    const select = <QuerySelect>result.patterns[0];
    select.distinct = true;
    return result;
  },
};
