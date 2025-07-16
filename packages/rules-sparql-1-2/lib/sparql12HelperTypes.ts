import type { GeneratorRule, ParserRule } from '@traqula/core';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type { Factory } from './Factory';

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
> = GeneratorRule<{ factory: Factory }, NameType, ReturnType, ParamType>;

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

export type SparqlContext = T11.SparqlContext & { factory: Factory };
