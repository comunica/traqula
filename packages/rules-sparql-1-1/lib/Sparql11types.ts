import type { ParserRule, GeneratorRule } from '@traqula/core';
import type { TraqulaFactory } from './factory';

export type SparqlRule<
  /**
   * Name of grammar rule, should be a strict subtype of string like 'myGrammarRule'.
   */
  NameType extends string = string,
  /**
   * Type that will be returned after a correct parse of this rule.
   * This type will be the return type of calling SUBRULE with this grammar rule.
   */
  ReturnType = unknown,
  GenInputType = ReturnType,
  /**
   * Function arguments that can be given to convey the state of the current parse operation.
   */
  ParamType = undefined,
> = SparqlGrammarRule<NameType, ReturnType, ParamType>
  & SparqlGeneratorRule<NameType, GenInputType, ParamType>;

export type SparqlGeneratorRule<
  /**
   * Name of grammar rule, should be a strict subtype of string like 'myGrammarRule'.
   */
  NameType extends string = string,
  /**
   * Type that will be returned after a correct parse of this rule.
   * This type will be the return type of calling SUBRULE with this grammar rule.
   */
  ReturnType = unknown,
  /**
   * Function arguments that can be given to convey the state of the current parse operation.
   */
  ParamType = undefined,
> = GeneratorRule<{ factory: TraqulaFactory }, NameType, ReturnType, ParamType>;

export type SparqlGrammarRule<
  /**
   * Name of grammar rule, should be a strict subtype of string like 'myGrammarRule'.
   */
  NameType extends string = string,
  /**
   * Type that will be returned after a correct parse of this rule.
   * This type will be the return type of calling SUBRULE with this grammar rule.
   */
  ReturnType = unknown,
  /**
   * Function arguments that can be given to convey the state of the current parse operation.
   */
  ParamType = undefined,
> = ParserRule<SparqlContext, NameType, ReturnType, ParamType>;

export interface SparqlContext {
  /**
   * Data-factory to be used when constructing rdf primitives.
   */
  factory: TraqulaFactory;
  /**
   * Current scoped prefixes. Used for resolving prefixed names.
   */
  prefixes: Record<string, string>;
  /**
   * The base IRI for the query. Used for resolving relative IRIs.
   */
  baseIRI: string | undefined;
  /**
   * Can be used to disable the validation that used variables in a select clause are in scope.
   */
  skipValidation: boolean;
  /**
   * Set of queryModes. Primarily used for note 8, 14.
   */
  parseMode: Set<'canParseVars' | 'canCreateBlankNodes' | 'inAggregate' | 'canParseAggregate' | string>;
}
