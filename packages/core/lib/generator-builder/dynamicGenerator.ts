import { AstCoreFactory } from '../AstCoreFactory.js';
import type { SourceLocationInlinedSource } from '../types.js';
import {
  SOURCE_LOC_SOURCE,
  SOURCE_LOC_INLINED_SOURCE,
  SOURCE_LOC_NO_MATERIALIZE,
  SOURCE_LOC_STRING_REPLACE,
  SOURCE_LOC_NODE_REPLACE,
} from '../types.js';
import { traqulaIndentation, traqulaNewlineAlternative } from '../utils.js';
import type { GenRuleMap } from './builderTypes.js';
import type { GeneratorRule, RuleDefArg } from './generatorTypes.js';

export interface GeneratorContext {
  [traqulaIndentation]?: number;
  [traqulaNewlineAlternative]?: string;
}

export class DynamicGenerator<Context, Names extends string, RuleDefs extends GenRuleMap<Names>> {
  protected readonly factory = new AstCoreFactory();
  protected __context: Context | undefined = undefined;
  protected origSource = '';
  /**
   * Reference to the latest SourceLocationInlinedSource this generator handled (used for idempotency)
   * @protected
   */
  protected handledInlineSource: SourceLocationInlinedSource | undefined;
  protected generatedUntil = 0;
  protected toEnsure: ((willPrint: string) => void)[] = [];
  /**
   * Should not contain empty strings
   * @protected
   */
  protected readonly stringBuilder: string[] = [];

  // Cached RuleDefArg to avoid allocating a new object on every subrule call
  private readonly cachedRuleDefArg: RuleDefArg;
  // Cache gImpl results per rule to avoid creating a new closure on every subrule call
  private readonly gImplCache = new Map<string, (...args: any[]) => void>();

  public constructor(protected rules: RuleDefs) {
    this.cachedRuleDefArg = {
      SUBRULE: this.subrule,
      PRINT: this.print,
      ENSURE: this.ensure,
      ENSURE_EITHER: this.ensureEither,
      NEW_LINE: this.newLine,
      HANDLE_LOC: this.handleLoc,
      CATCHUP: this.catchup,
      PRINT_WORD: this.printWord,
      PRINT_WORDS: this.printWords,
      PRINT_ON_EMPTY: this.printOnEmpty,
      PRINT_ON_OWN_LINE: this.printOnOwnLine,
    };

    // eslint-disable-next-line ts/no-unnecessary-type-assertion
    for (const rule of <GeneratorRule[]> Object.values(rules)) {
      // Define function implementation
      this[<keyof (typeof this)> rule.name] =
        <any> ((input: any, context: Context & { origSource: string; offset?: number }, args: any) => {
          this.stringBuilder.length = 0;
          this.toEnsure.length = 0;
          this.origSource = context.origSource;
          this.generatedUntil = context?.offset ?? 0;
          this.setContext(context);

          this.subrule(rule, input, args);

          this.catchup(this.origSource.length);
          this.handeEnsured('');

          return this.stringBuilder.join('');
        });
    }
  }

  public setContext(context: Context): void {
    this.__context = context;
  }

  protected getSafeContext(): Context & GeneratorContext {
    return <Context & GeneratorContext> this.__context;
  }

  protected readonly subrule: RuleDefArg['SUBRULE'] = (cstDef, ast, ...arg) => {
    const name = <Names> cstDef.name;
    let impl = this.gImplCache.get(name);
    if (!impl) {
      const def = this.rules[name];
      if (!def) {
        throw new Error(`Rule ${cstDef.name} not found`);
      }
      impl = def.gImpl(this.cachedRuleDefArg);
      this.gImplCache.set(name, impl);
    }

    const generate = (): void => impl(ast, this.getSafeContext(), ...arg);

    if (this.factory.isLocalized(ast)) {
      this.handleLoc(ast, generate);
    } else {
      generate();
    }
  };

  protected readonly handleLoc: RuleDefArg['HANDLE_LOC'] = (localized, handle) => {
    const loc = localized.loc;
    // SOURCE is the most common case during normal parsing — check it first
    if (loc.sourceLocationType === SOURCE_LOC_SOURCE) {
      this.catchup(loc.start);
      const ret = handle();
      this.catchup(loc.end);
      return ret;
    }
    if (loc.sourceLocationType === SOURCE_LOC_NO_MATERIALIZE) {
      return;
    }
    if (loc.sourceLocationType === SOURCE_LOC_STRING_REPLACE) {
      this.catchup(loc.start);
      this.print(loc.newSource);
      this.generatedUntil = loc.end;
      return;
    }
    if (loc.sourceLocationType === SOURCE_LOC_NODE_REPLACE) {
      this.catchup(loc.start);
      this.generatedUntil = loc.end;
      return handle();
    }
    if (loc.sourceLocationType === SOURCE_LOC_INLINED_SOURCE && this.handledInlineSource !== loc) {
      // Idempotence: calling handleLoc on the same AST multiple times should be the same as doing it once.
      this.handledInlineSource = loc;
      // Like normal, catch up until the start of what this node represents.
      this.catchup(loc.start);
      // Save pointer location of current source and register new source.
      const origSource = this.origSource;
      const origPointer = this.generatedUntil;
      this.origSource = loc.newSource;
      this.generatedUntil = 0;
      // Catchup the new source to where this node starts representing the source.
      this.catchup(loc.startOnNew);

      const ret = this.handleLoc(loc, handle);

      // Catchup so the entire new source is generated outside what this node represents.
      this.generatedUntil = loc.endOnNew;
      this.catchup(this.origSource.length);
      // Recover the original source and register that you generated the range of this node.
      this.origSource = origSource;
      this.generatedUntil = Math.max(origPointer, loc.end);
      return ret;
    }
    // AUTO_GENERATE or already-handled INLINED_SOURCE: just handle
    return handle();
  };

  /**
   * Catchup until, excluding
   */
  // Pre-compiled regex patterns to avoid re-creation in hot loops
  private static readonly BLANK_LINE_RE = /^[ \t]*$/u;
  private static readonly TRAILING_BLANKS_RE = /[\t ]*$/u;
  private static readonly NEWLINE_TRAILING_RE = /\n[ \t]*$/u;

  protected readonly catchup: RuleDefArg['CATCHUP'] = (until) => {
    const start = this.generatedUntil;
    if (start < until) {
      const sliced = this.origSource.slice(start, until);
      this.handeEnsured(sliced);
      this.stringBuilder.push(sliced);
    }
    this.generatedUntil = Math.max(this.generatedUntil, until);
  };

  private handeEnsured(toPrint: string): void {
    const toEnsure = this.toEnsure;
    if (toEnsure.length > 0) {
      for (const fn of toEnsure) {
        fn(toPrint);
      }
      toEnsure.length = 0;
    }
  }

  protected readonly print: RuleDefArg['PRINT'] = (...args) => {
    const joined = args.length === 1 ? args[0] : args.join('');
    this.handeEnsured(joined);
    this.stringBuilder.push(joined);
  };

  private doesEndWith(subsStr: string): boolean {
    const sb = this.stringBuilder;
    if (sb.length === 0) {
      return false;
    }
    // Fast path: if last segment is long enough, no need to pop/merge
    const last = sb.at(-1)!;
    if (last.length >= subsStr.length) {
      return last.endsWith(subsStr);
    }
    // Slow path: pop, merge, push back (compaction needed for correctness)
    const len = subsStr.length;
    let temp = '';
    while (temp.length < len && sb.length > 0) {
      temp = sb.pop() + temp;
    }
    sb.push(temp);
    return temp.endsWith(subsStr);
  }

  protected readonly ensure: RuleDefArg['ENSURE'] = (...args) => {
    // Check whether already present
    const toEnsure = args.join('');
    if (!this.doesEndWith(toEnsure)) {
      this.toEnsure.push((willPrint) => {
        if (!willPrint.startsWith(toEnsure) && !this.doesEndWith(toEnsure)) {
          this.stringBuilder.push(toEnsure);
        }
      });
    }
  };

  protected readonly ensureEither: RuleDefArg['ENSURE_EITHER'] = (...args) => {
    if (args.length === 1) {
      this.ensure(args[0]);
    } else if (args.length > 1) {
      let alreadyMatched = false;
      for (const arg of args) {
        if (this.doesEndWith(arg)) {
          alreadyMatched = true;
          break;
        }
      }
      if (!alreadyMatched) {
        const firstArg = args[0];
        this.toEnsure.push((willPrint) => {
          let startsMatch = false;
          for (const arg of args) {
            if (willPrint.startsWith(arg)) {
              startsMatch = true;
              break;
            }
          }
          if (!startsMatch) {
            let endsMatch = false;
            for (const arg of args) {
              if (this.doesEndWith(arg)) {
                endsMatch = true;
                break;
              }
            }
            if (!endsMatch) {
              this.stringBuilder.push(firstArg);
            }
          }
        });
      }
    }
  };

  private pruneEndingBlanks(): void {
    const sb = this.stringBuilder;
    let temp = '';
    while (DynamicGenerator.BLANK_LINE_RE.test(temp) && sb.length > 0) {
      temp = sb.pop() + temp;
    }
    const pruned = temp.replace(DynamicGenerator.TRAILING_BLANKS_RE, '');
    this.handeEnsured(pruned);
    sb.push(pruned);
  }

  protected readonly newLine: RuleDefArg['NEW_LINE'] = (arg) => {
    const indentation = this.getSafeContext()[traqulaIndentation] ?? 0;
    const force = arg?.force ?? false;
    if (indentation < 0) {
      const newlineAlternative = this.getSafeContext()[traqulaNewlineAlternative];
      if (newlineAlternative !== undefined &&
        // If we force, it means we would print \n no matter. - otherwise check whether we have printed the char
        (force || (this.stringBuilder.at(-1) !== newlineAlternative))) {
        this.handeEnsured(newlineAlternative);
        this.stringBuilder.push(newlineAlternative);
      }
      return;
    }
    this.pruneEndingBlanks();
    if (force) {
      this.print('\n', ' '.repeat(indentation));
    } else {
      const sb = this.stringBuilder;
      let temp = '';
      while (!temp.includes('\n') && sb.length > 0) {
        temp = sb.pop() + temp;
      }
      if (DynamicGenerator.NEWLINE_TRAILING_RE.test(temp)) {
        // Pointer is on empty newline -> set correct indentation
        temp = temp.replace(DynamicGenerator.NEWLINE_TRAILING_RE, `\n${' '.repeat(indentation)}`);
        this.handeEnsured(temp);
        sb.push(temp);
      } else {
        // Pointer not on empty newline, print newline.
        this.print(temp, '\n', ' '.repeat(indentation));
      }
    }
  };

  private readonly printWord: RuleDefArg['PRINT_WORD'] = (...args) => {
    this.ensureEither(' ', '\n');
    this.print(...args);
    this.ensureEither(' ', '\n');
  };

  private readonly printWords: RuleDefArg['PRINT_WORD'] = (...args) => {
    for (const arg of args) {
      this.printWord(arg);
    }
  };

  private readonly printOnEmpty: RuleDefArg['PRINT_ON_EMPTY'] = (...args) => {
    this.newLine();
    this.print(...args);
  };

  private readonly printOnOwnLine: RuleDefArg['PRINT_ON_OWN_LINE'] = (...args) => {
    this.newLine();
    this.print(...args);
    this.newLine();
  };
}
