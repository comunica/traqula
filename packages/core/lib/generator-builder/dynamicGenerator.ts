import { AstCoreFactory } from '../AstCoreFactory.js';
import { traqulaIndentation } from '../utils.js';
import type { GenRuleMap } from './builderTypes.js';
import type { GeneratorRule, RuleDefArg } from './generatorTypes.js';

export class DynamicGenerator<Context, Names extends string, RuleDefs extends GenRuleMap<Names>> {
  protected readonly factory = new AstCoreFactory();
  protected __context: Context | undefined = undefined;
  protected origSource = '';
  protected generatedUntil = 0;
  protected expectsSpace: boolean;
  protected readonly stringBuilder: string[] = [];

  public constructor(protected rules: RuleDefs) {
    // eslint-disable-next-line ts/no-unnecessary-type-assertion
    for (const rule of <GeneratorRule[]> Object.values(rules)) {
      // Define function implementation
      this[<keyof (typeof this)> rule.name] =
        <any> ((input: any, context: Context & { origSource: string; offset?: number }, args: any) => {
          this.expectsSpace = false;
          this.stringBuilder.length = 0;
          this.origSource = context.origSource;
          this.generatedUntil = context?.offset ?? 0;
          this.setContext(context);

          this.subrule(rule, input, args);

          this.catchup(this.origSource.length);

          return this.stringBuilder.join('');
        });
    }
  }

  public setContext(context: Context): void {
    this.__context = context;
  }

  protected getSafeContext(): Context & { [traqulaIndentation]?: unknown } {
    return <Context & { [traqulaIndentation]?: unknown }> this.__context;
  }

  protected readonly subrule: RuleDefArg['SUBRULE'] = (cstDef, ast, ...arg) => {
    const def = this.rules[<Names> cstDef.name];
    if (!def) {
      throw new Error(`Rule ${cstDef.name} not found`);
    }

    const generate = (): void => def.gImpl({
      SUBRULE: this.subrule,
      PRINT: this.print,
      PRINT_SPACE_LEFT: this.printSpaceLeft,
      PRINT_WORD: this.printWord,
      PRINT_WORDS: this.printWords,
      PRINT_ON_EMPTY: this.printOnEmpty,
      CATCHUP: this.catchup,
      HANDLE_LOC: this.handleLoc,
    })(ast, this.getSafeContext(), ...arg);

    if (this.factory.isLocalized(ast)) {
      this.handleLoc(ast, generate);
    } else {
      generate();
    }
  };

  protected readonly handleLoc: RuleDefArg['HANDLE_LOC'] = (localized, handle) => {
    if (this.factory.isSourceLocationNoMaterialize(localized.loc)) {
      return;
    }
    if (this.factory.isSourceLocationStringReplace(localized.loc)) {
      this.catchup(localized.loc.start);
      this.print(localized.loc.newSource);
      this.generatedUntil = localized.loc.end;
      return;
    }
    if (this.factory.isSourceLocationNodeReplace(localized.loc)) {
      this.catchup(localized.loc.start);
      this.generatedUntil = localized.loc.end;
    }
    if (this.factory.isSourceLocationSource(localized.loc)) {
      this.catchup(localized.loc.start);
    }
    // If autoGenerate - do nothing

    const ret = handle();

    if (this.factory.isSourceLocationSource(localized.loc)) {
      this.catchup(localized.loc.end);
    }
    return ret;
  };

  protected readonly catchup: RuleDefArg['CATCHUP'] = (until) => {
    const start = this.generatedUntil;
    if (start < until) {
      this.print(this.origSource.slice(start, until));
    }
    this.generatedUntil = Math.max(this.generatedUntil, until);
  };

  protected readonly print: RuleDefArg['PRINT'] = (...args) => {
    const pureArgs = args.filter(x => x.length > 0);
    if (pureArgs.length > 0) {
      const head = pureArgs[0];
      if (this.expectsSpace) {
        this.expectsSpace = false;
        const blanks = new Set([ '\n', ' ', '\t' ]);
        if (this.stringBuilder.length > 0 &&
          !(blanks.has(head[0]) || blanks.has(this.stringBuilder.at(-1)!.at(-1)!))) {
          this.stringBuilder.push(' ');
        }
      }
      const context = this.getSafeContext();
      if (context[traqulaIndentation] && typeof context[traqulaIndentation] === 'number') {
        const indent = context[traqulaIndentation];
        for (const str of pureArgs) {
          const [ noNl, ...postNl ] = str.split('\n');
          this.stringBuilder.push(noNl);
          for (const subStr of postNl.map(line => line.trimStart())) {
            this.stringBuilder.push('\n', ' '.repeat(indent));
            if (subStr.length > 0) {
              this.stringBuilder.push(subStr);
            }
          }
        }
      } else {
        this.stringBuilder.push(...pureArgs);
      }
    }
  };

  private readonly printWord: RuleDefArg['PRINT_WORD'] = (...args) => {
    this.expectsSpace = true;
    this.print(...args);
    this.expectsSpace = true;
  };

  private readonly printSpaceLeft: RuleDefArg['PRINT_WORD'] = (...args) => {
    this.expectsSpace = true;
    this.print(...args);
  };

  private readonly printWords: RuleDefArg['PRINT_WORD'] = (...args) => {
    for (const arg of args) {
      this.printWord(arg);
    }
  };

  private readonly printOnEmpty: RuleDefArg['PRINT_ON_EMPTY'] = (...args) => {
    // Check if pointer already on empty line
    let counter = this.stringBuilder.length - 1;
    let onEmpty = true;
    const isEmptyTest = /^[ \t\n]*$/u;
    while (counter >= 0 && onEmpty) {
      const cur = this.stringBuilder[counter];
      const indexOfNl = cur.lastIndexOf('\n');
      if (indexOfNl >= 0) {
        // This is the last newline that is printed
        onEmpty = isEmptyTest.test(cur.slice(indexOfNl));
        if (onEmpty) {
          // We still want to have the current indent printed
          const newVal = cur.slice(0, indexOfNl);
          if (newVal) {
            this.stringBuilder[counter] = cur.slice(0, indexOfNl);
          } else {
            this.stringBuilder.splice(counter, 1);
          }
        }
        break;
      }
      onEmpty = isEmptyTest.test(cur);
      counter--;
    }
    this.print('\n', ...args);
  };
}
