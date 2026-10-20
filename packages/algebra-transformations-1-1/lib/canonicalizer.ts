import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import * as Algebra from './algebra.js';
import * as util from './util.js';
import { AlgebraFactory } from './index.js';

/**
 * Utility for canonicalizing SPARQL Algebra operations by replacing blank node
 * and variable names with deterministic generated names,
 * and by sorting the variables of projections, since those form a set.
 * Useful for comparing algebra representations in tests.
 */
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
   * This includes the blank nodes of CONSTRUCT templates: they get a new name but remain blank nodes.
   * @param res
   * @param replaceVariables
   */
  public canonicalizeQuery(res: Algebra.Operation, replaceVariables: boolean): Algebra.Operation {
    this.blankId = 0;
    const nameMapping: Record<string, string> = Object.create(null);
    const factory = new AlgebraFactory();

    return util.mapOperation<'unsafe', typeof res>(res, {
      [Algebra.Types.PROJECT]: {
        transform: projectOp => factory.createProject(
          projectOp.input,
          [ ...projectOp.variables ].sort((left, right) => left.value.localeCompare(right.value)),
        ),
      },
      [Algebra.Types.PATH]: {
        transform: pathOp => factory.createPath(
          this.replaceValue(pathOp.subject, nameMapping, replaceVariables, factory),
          pathOp.predicate,
          this.replaceValue(pathOp.object, nameMapping, replaceVariables, factory),
          this.replaceValue(pathOp.graph, nameMapping, replaceVariables, factory),
        ),
      },
      [Algebra.Types.PATTERN]: {
        transform: patternOp => factory.createPattern(
          this.replaceValue(patternOp.subject, nameMapping, replaceVariables, factory),
          this.replaceValue(patternOp.predicate, nameMapping, replaceVariables, factory),
          this.replaceValue(patternOp.object, nameMapping, replaceVariables, factory),
          this.replaceValue(patternOp.graph, nameMapping, replaceVariables, factory),
        ),
      },
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
