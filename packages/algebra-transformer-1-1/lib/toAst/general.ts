import type * as RDF from '@rdfjs/types';
import type {
  DatasetClauses,
  Pattern,
  PatternGroup,
  QuerySelect,
  TermBlank,
  TermIri,
  TermLiteral,
  TermVariable,
  TripleNesting,
} from '@traqula/rules-sparql-1-1';
import type { TermTriple } from '@traqula/rules-sparql-1-2';
import type { Algebra } from '../index';
import Util from '../util';
import type { AstContext } from './core';
import { translatePureExpression } from './expression';
import { translatePatternIntoGroup, translatePatternNew } from './pattern';

type RdfTermToAst<T extends RDF.Term> = T extends RDF.Variable ? TermVariable :
  T extends RDF.BlankNode ? TermBlank :
    T extends RDF.Literal ? TermLiteral :
      T extends RDF.NamedNode ? TermIri : never;

export function translateTerm<T extends RDF.Term>(c: AstContext, term: T): RdfTermToAst<T> {
  const F = c.astFactory;
  if (term.termType === 'NamedNode') {
    return <RdfTermToAst<T>> F.namedNode(F.gen(), term.value);
  }
  if (term.termType === 'BlankNode') {
    return <RdfTermToAst<T>> F.blankNode(term.value, F.gen());
  }
  if (term.termType === 'Variable') {
    return <RdfTermToAst<T>> F.variable(term.value, F.gen());
  }
  if (term.termType === 'Literal') {
    return <RdfTermToAst<T>> F.literalTerm(
      F.gen(),
      term.value,
      term.language ? term.language : translateTerm(c, term.datatype),
    );
  }
  // TODO: migrate to use function indirection
  if (term.termType === 'Quad') {
    return <any> {
      type: 'term',
      subType: 'triple',
      subject: translateTerm(c, term.subject),
      predicate: <TermIri | TermVariable> translateTerm(c, term.predicate),
      object: translateTerm(c, term.object),
      loc: F.gen(),
    } satisfies TermTriple;
  }
  throw new Error(`invalid term type: ${term.termType}`);
}

/**
 * Extend is for example a bind, or an aggregator.
 * The result is thus registered to be tackled at the project level,
 *  or if we are not in project scope, we give it as a patternBind
 *  - of course, the pattern bind is scoped with the other operations at this level
 */
export function translateExtend(c: AstContext, op: Algebra.Extend): Pattern | Pattern[] {
  const F = c.astFactory;
  if (c.project) {
    c.extend.push(op);
    return translatePatternNew(c, op.input);
  }
  return Util.flatten([
    translatePatternNew(c, op.input),
    F.patternBind(
      translatePureExpression(c, op.expression),
      translateTerm(c, op.variable),
      F.gen(),
    ),
  ]);
}

export function translateDatasetClauses(
  c: AstContext,
  _default: RDF.NamedNode[],
  named: RDF.NamedNode[],
): DatasetClauses {
  const F = c.astFactory;
  return F.datasetClauses([
    ..._default.map(x => (<const>{ clauseType: 'default', value: translateTerm(c, x) })),
    ...named.map(x => (<const>{ clauseType: 'named', value: translateTerm(c, x) })),
  ], F.gen());
}

/**
 * An order by is just registered to be handled in the creation of your QueryBase
 */
export function translateOrderBy(c: AstContext, op: Algebra.OrderBy): Pattern | Pattern[] {
  c.order.push(...op.expressions);
  return translatePatternNew(c, op.input);
}

export function translatePattern(c: AstContext, op: Algebra.Pattern): TripleNesting {
  const F = c.astFactory;
  return F.triple(
    translateTerm(c, op.subject),
    <TripleNesting['predicate']> translateTerm(c, op.predicate),
    translateTerm(c, op.object),
  );
}

/**
 * Reduced is wrapped around a project, set the query contained to be distinct
 */
export function translateReduced(c: AstContext, op: Algebra.Reduced): PatternGroup {
  const result = translatePatternIntoGroup(c, op.input);
  const select = <QuerySelect>result.patterns[0];
  select.reduced = true;
  return result;
}

/**
 * District is wrapped around a project, set the query contained to be distinct
 */
export function translateDistinct(c: AstContext, op: Algebra.Distinct): PatternGroup {
  const result = translatePatternIntoGroup(c, op.input);
  const select = <QuerySelect>result.patterns[0];
  select.distinct = true;
  return result;
}
