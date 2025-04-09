import { GeneratorBuilder, type Patch } from '@traqula/core';
import { sparql11GeneratorBuilder } from '@traqula/generator-sparql-1-1';
import { gram as g11 } from '@traqula/rules-sparql-1-1';
import { gram as g12 } from '@traqula/rules-sparql-1-2';
import type { types as T12 } from '@traqula/rules-sparql-1-2';

const sparql12GeneratorBuilder =
  GeneratorBuilder.createBuilder(sparql11GeneratorBuilder).typePatch<{
    [g11.query.name]: T12.Query;
    [g11.selectQuery.name]: Omit<T12.SelectQuery, g11.HandledByBase>;
    [g11.constructQuery.name]: Omit<T12.ConstructQuery, g11.HandledByBase>;
    [g11.describeQuery.name]: Omit<T12.DescribeQuery, g11.HandledByBase>;
    [g11.askQuery.name]: Omit<T12.AskQuery, g11.HandledByBase>;
    [g11.valuesClause.name]: T12.ValuePatternRow[] | undefined;
    [g11.selectClause.name]: g11.ISelectClause;
    [g11.constructTemplate.name]: T12.Triple[] | undefined;
    [g11.update.name]: T12.Update;
    [g11.update1.name]: T12.UpdateOperation;
    [g11.load.name]: T12.LoadOperation;
    [g11.clear.name]: T12.ClearDropOperation;
    [g11.drop.name]: T12.ClearDropOperation;
    [g11.create.name]: T12.CreateOperation;
    [g11.add.name]: T12.CopyMoveAddOperation & { type: 'add' };
    [g11.move.name]: T12.CopyMoveAddOperation & { type: 'move' };
    [g11.copy.name]: T12.CopyMoveAddOperation & { type: 'copy' };
    [g11.insertData.name]: T12.InsertOperation;
    [g11.deleteData.name]: T12.DeleteOperation;
    [g11.deleteWhere.name]: T12.DeleteWhereOperation;
    [g11.modify.name]: T12.ModifyOperation;

    [g11.graphOrDefault.name]: T12.GraphOrDefault;
    [g11.graphRef.name]: T12.IriTerm;
    [g11.graphRefAll.name]: T12.GraphReference;
    [g11.quadData.name]: T12.Quads[];
    [g11.quads.name]: T12.Quads[];
    [g11.quadsNotTriples.name]: T12.GraphQuads[];

    [g11.aggregate.name]: T12.AggregateExpression;
    // [g11.datasetClause.name]: unchanged;
    [g11.argList.name]: Patch<g11.IArgList, { args: T12.Expression[] }>;
    [g11.expression.name]: T12.Expression;
    [g11.iriOrFunction.name]:
      T12.IriTerm | (Patch<g11.IArgList, { args: T12.Expression[] }> & { function: T12.IriTerm });
    [g11.prologue.name]: Pick<T12.BaseQuery, 'base' | 'prefixes'>;

    [g11.varOrTerm.name]: T12.Term;
    // [g11.var_.name]: unchanged;
    [g11.graphTerm.name]: T12.GraphTerm;
    [g11.rdfLiteral.name]: T12.LiteralTerm;
    // [g11.string.name]: unchanged;
    // [g11.iri.name]: unchanged;
    // [g11.blankNode.name]: unchanged;
    // [g11.path.name]: unchanged;
    [g11.solutionModifier.name]: Pick<T12.SelectQuery, 'group' | 'having' | 'order' | 'limit' | 'offset'>;
    [g11.groupClause.name]: T12.Grouping[];
    [g11.groupCondition.name]: T12.Grouping;
    [g11.havingClause.name]: T12.Expression[];
    [g11.orderClause.name]: T12.Ordering[];
    [g11.orderCondition.name]: T12.Ordering;
    [g11.limitOffsetClauses.name]: Pick<T12.SelectQuery, 'limit' | 'offset'>;
    [g11.triplesBlock.name]: T12.BgpPattern;
    [g11.groupGraphPattern.name]: T12.GroupPattern;
    [g11.graphPatternNotTriples.name]: T12.ValuesPattern | T12.BindPattern | T12.FilterPattern | T12.BlockPattern;
    [g11.optionalGraphPattern.name]: T12.OptionalPattern;
    [g11.graphGraphPattern.name]: T12.GraphPattern;
    [g11.serviceGraphPattern.name]: T12.ServicePattern;
    [g11.bind.name]: T12.BindPattern;
    [g11.inlineDataFull.name]: T12.ValuePatternRow[];
    [g11.dataBlockValue.name]: T12.ValuePatternRow[];
    [g11.minusGraphPattern.name]: T12.MinusPattern;
    [g11.groupOrUnionGraphPattern.name]: T12.GroupPattern | T12.UnionPattern;
    [g11.filter.name]: T12.FilterPattern;
  }>()
    .addRule(g12.tripleTerm)
    .patchRule(g12.varOrTerm)
    .deleteRule(g11.graphTerm.name)
    .patchRule(g12.dataBlockValue);

export class Generator {
  private readonly generator = sparql12GeneratorBuilder.build();

  public generate(ast: T12.Query | T12.Update | Pick<T12.Update, 'base' | 'prefixes'>): string {
    if ('type' in ast) {
      if (ast.type === 'update') {
        return this.generator.update(ast, undefined, undefined);
      }
      return this.generator.query(ast, undefined, undefined);
    }
    return this.generator.prologue(ast, undefined, undefined);
  }

  public generatePath(ast: T12.IriTerm | T12.PropertyPath): string {
    return this.generator.path(ast, undefined, undefined);
  }
}
