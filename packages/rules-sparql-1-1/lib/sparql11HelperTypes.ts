import type { GeneratorRule, ParserRule, traqulaIndentation, traqulaNewlineAlternative } from '@traqula/core';
import type { AstFactory } from './astFactory.js';

export interface SparqlContext {
  /**
   * Data-factoryMixins to be used when constructing rdf primitives.
   */
  astFactory: AstFactory;
  /**
   * Current scoped prefixes. Used to validate parsed prefixes are known,
   * and to resolve the IRIs of function calls against `verifyWithNamedAggregators`.
   */
  prefixes: Record<string, string>;
  /**
   * Currently scoped base IRI. Only used to resolve the IRIs of function calls against `verifyWithNamedAggregators`.
   */
  baseIRI: string | undefined;
  /**
   * Can be used to disable the validation that used variables in a select clause are in scope.
   */
  skipValidation: boolean;
  /**
   * The full IRIs of the custom aggregate functions that the query will be evaluated with.
   * Custom aggregates are syntactically function calls, so without this set,
   * validation leniently assumes that any function call might be an aggregate.
   * With this set, only function calls whose IRI is in the set are aggregates,
   * and only those can use the DISTINCT keyword.
   * Default `undefined`.
   */
  verifyWithNamedAggregators?: Set<string>;
  /**
   * Set of queryModes. Primarily used for note 8, 14.
   */
  parseMode: Set<'canParseVars' | 'canCreateBlankNodes' | 'inAggregate' | 'canParseAggregate' | string>;
}

export interface SparqlGeneratorContext {
  astFactory: AstFactory;
  indentInc: number;
  origSource: string;
  [traqulaIndentation]: number;
  [traqulaNewlineAlternative]: string;
}

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
  ParamType extends any[] = [],
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
  ParamType extends any[] = [],
> = GeneratorRule<SparqlGeneratorContext, NameType, ReturnType, ParamType>;
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
  ParamType extends any[] = [],
> = ParserRule<SparqlContext, NameType, ReturnType, ParamType>;
