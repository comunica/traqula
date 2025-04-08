import type { GenRuleMap } from './builderTypes';
import type { GeneratorRule, RuleDefArg } from './generatorTypes';

export class DynamicGenerator<Context, Names extends string, RuleDefs extends GenRuleMap<Names>> {
  private __context: Context | undefined = undefined;

  public setContext(context: Context): void {
    this.__context = context;
  }

  private getSafeContext(): Context {
    return <Context> this.__context;
  }

  public constructor(rules: RuleDefs) {
    const selfRef: RuleDefArg = {
      SUBRULE: (cstDef, input, arg) => {
        const def = rules[<Names>cstDef.name];
        if (!def) {
          throw new Error(`Rule ${cstDef.name} not found`);
        }
        return def.gImpl(selfRef)(input, this.getSafeContext(), arg);
      },
    };

    // eslint-disable-next-line ts/no-unnecessary-type-assertion
    for (const rule of <GeneratorRule[]>Object.values(rules)) {
      this[<keyof (typeof this)>rule.name] = <any>((input: any, context: Context, args: any) => {
        this.setContext(context);
        return rule.gImpl(selfRef)(input, this.getSafeContext(), args);
      });
    }
  }
}
