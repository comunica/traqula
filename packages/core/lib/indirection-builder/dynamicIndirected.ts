import type { IndirDef, IndirDefArg, IndirectionMap } from './helpers.js';

export class DynamicIndirect<Context, Names extends string, RuleDefs extends IndirectionMap<Names>> {
  protected __context: Context | undefined = undefined;
  // Cached IndirDefArg to avoid allocating a new object on every subrule call
  private readonly cachedIndirDefArg: IndirDefArg;
  // Cache fun() results per rule to avoid creating a new closure on every subrule call
  private readonly funCache = new Map<string, (...args: any[]) => any>();

  public constructor(protected rules: RuleDefs) {
    this.cachedIndirDefArg = {
      SUBRULE: this.subrule,
    };

    for (const rule of Object.values(<Record<string, IndirDef<Context>>>rules)) {
      this[<keyof (typeof this)>rule.name] = <any> ((context: Context, ...args: any): any => {
        this.setContext(context);
        return this.subrule(rule, ...args);
      });
    }
  }

  public setContext(context: Context): void {
    this.__context = context;
  }

  protected getSafeContext(): Context {
    return <Context> this.__context;
  }

  protected readonly subrule: IndirDefArg['SUBRULE'] = (cstDef, ...args) => {
    const name = <Names> <unknown> cstDef.name;
    let impl = this.funCache.get(name);
    if (!impl) {
      const def = this.rules[name];
      if (!def) {
        throw new Error(`Rule ${cstDef.name} not found`);
      }
      impl = def.fun(this.cachedIndirDefArg);
      this.funCache.set(name, impl);
    }

    return impl(this.getSafeContext(), ...args);
  };
}
