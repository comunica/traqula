import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import * as Algebra from './algebra.js';
import * as utils from './util.js';
import type { AlgebraFactory } from './index.js';

export class Canonicalizer {
  public constructor() {
    this.blankId = 0;
  }

  public blankId: number;
  public genValue(): string {
    return `value_${this.blankId++}`;
  }

  /**
   * Replaces values of BlankNodes in a query with newly generated names.
   * @param res
   * @param replaceVariables
   */
  public canonicalizeQuery(res: Algebra.Operation, replaceVariables: boolean): Algebra.Operation {
    this.blankId = 0;
    const nameMapping: Record<string, string> = {};
    return utils.mapOperation(res, {
      [Algebra.KnownTypes.PATH]: (op: Algebra.Path, factory: AlgebraFactory) => ({
        result: factory.createPath(
          this.replaceValue(op.subject, nameMapping, replaceVariables, factory),
          op.predicate,
          this.replaceValue(op.object, nameMapping, replaceVariables, factory),
          this.replaceValue(op.graph, nameMapping, replaceVariables, factory),
        ),
        recurse: true,
      }),
      [Algebra.KnownTypes.PATTERN]: (op: Algebra.Pattern, factory: AlgebraFactory) => ({
        result: factory.createPattern(
          this.replaceValue(op.subject, nameMapping, replaceVariables, factory),
          this.replaceValue(op.predicate, nameMapping, replaceVariables, factory),
          this.replaceValue(op.object, nameMapping, replaceVariables, factory),
          this.replaceValue(op.graph, nameMapping, replaceVariables, factory),
        ),
        recurse: true,
      }),
      [Algebra.KnownTypes.CONSTRUCT]: (op: Algebra.Construct, factory: AlgebraFactory) =>
        // Blank nodes in CONSTRUCT templates must be maintained
        ({
          result: factory.createConstruct(op.input, op.template),
          recurse: true,
        })
      ,
    });
  }

  public replaceValue(
    term: RDF.Term,
    nameMapping: Record<string, string>,
    replaceVars: boolean,
    factory: AlgebraFactory,
  ): RDF.Term {
    if (term.termType === 'Quad') {
      return factory.createPattern(
        this.replaceValue(term.subject, nameMapping, replaceVars, factory),
        this.replaceValue(term.predicate, nameMapping, replaceVars, factory),
        this.replaceValue(term.object, nameMapping, replaceVars, factory),
        this.replaceValue(term.graph, nameMapping, replaceVars, factory),
      );
    }

    if (term.termType !== 'BlankNode' && (term.termType !== 'Variable' || !replaceVars)) {
      return term;
    }

    const dataFactory = new DataFactory();
    const generateTerm = term.termType === 'Variable' ?
      dataFactory.variable.bind(dataFactory) :
      dataFactory.blankNode.bind(dataFactory);

    let val = nameMapping[term.value];
    if (!val) {
      val = this.genValue();
      nameMapping[term.value] = val;
    }
    return generateTerm(val);
  }
}
