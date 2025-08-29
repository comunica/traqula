import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import type { Factory } from '.';
import { Algebra, utils } from '.';

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
      [Algebra.Types.PATH]: (op: Algebra.Path, factory: Factory) => ({
        result: factory.createPath(
          this.replaceValue(op.subject, nameMapping, replaceVariables, factory),
          op.predicate,
          this.replaceValue(op.object, nameMapping, replaceVariables, factory),
          this.replaceValue(op.graph, nameMapping, replaceVariables, factory),
        ),
        recurse: true,
      }),
      [Algebra.Types.PATTERN]: (op: Algebra.Pattern, factory: Factory) => ({
        result: factory.createPattern(
          this.replaceValue(op.subject, nameMapping, replaceVariables, factory),
          this.replaceValue(op.predicate, nameMapping, replaceVariables, factory),
          this.replaceValue(op.object, nameMapping, replaceVariables, factory),
          this.replaceValue(op.graph, nameMapping, replaceVariables, factory),
        ),
        recurse: true,
      }),
      [Algebra.Types.CONSTRUCT]: (op: Algebra.Construct, factory: Factory) =>
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
    factory: Factory,
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
