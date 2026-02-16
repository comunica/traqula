#!/usr/bin/env node
import { exitWithError, readInput, writeOutput } from '@traqula/cli-utils';
import { lex, sparqlCodepointEscape } from '@traqula/rules-sparql-1-1';
import minimist from 'minimist';
import { Parser, sparql11ParserBuilder } from '../dist/esm/lib/index.js';

const usage = `Usage: traqula-sparql-parser-1-1 [options] [query]

Parse SPARQL 1.1 queries to JSON AST.

Options:
  -h, --help                Show this help message
  -f, --file <path>        Read query from file instead of argument or stdin
  --rule <ruleName>        Parse using a specific grammar rule (default: parse)
                           Available rules: queryOrUpdate, query, queryUnit, path, etc.
  --base <iri>             Set base IRI
  --prefix <prefix=iri>    Add prefix (can be used multiple times)
  --skip-validation        Skip validation during parsing

Input:
  - Pass query as argument: traqula-sparql-parser-1-1 "SELECT * WHERE { ?s ?p ?o }"
  - Read from file: traqula-sparql-parser-1-1 -f query.sparql
  - Read from stdin: cat query.sparql | traqula-sparql-parser-1-1

Output:
  JSON AST is written to stdout

Examples:
  # Parse a full query
  traqula-sparql-parser-1-1 "SELECT * WHERE { ?s ?p ?o }"
  
  # Parse just a property path
  traqula-sparql-parser-1-1 --rule path "foaf:knows/foaf:name"
`;

async function main(): Promise<void> {
  const args = minimist(process.argv.slice(2), {
    boolean: [ 'help', 'skip-validation' ],
    string: [ 'file', 'rule', 'base', 'prefix' ],
    alias: { h: 'help', f: 'file' },
  });

  if (args.help) {
    process.stderr.write(`${usage}\n`);
    process.exit(0);
  }

  try {
    // Parse prefixes
    const prefixes: Record<string, string> = {};
    if (args.prefix) {
      const prefixArgs = Array.isArray(args.prefix) ? args.prefix : [ args.prefix ];
      for (const prefix of prefixArgs) {
        const match = /^([^=]+)=(.+)$/u.exec(prefix);
        if (!match) {
          exitWithError(`Invalid prefix format: ${prefix}. Expected format: prefix=iri`);
          // TypeScript doesn't understand exitWithError never returns
          return;
        }
        prefixes[match[1]] = match[2];
      }
    }

    // Read input
    const input = await readInput(args.file ?? args._[0], Boolean(args.file));
    if (!input.trim()) {
      exitWithError('No input provided');
    }

    const defaultContext: any = {
      baseIRI: args.base,
      prefixes,
      skipValidation: args['skip-validation'],
    };

    let ast: any;
    const ruleName = args.rule || 'parse';

    // If a specific rule is requested, build the parser directly and call that rule
    if (ruleName !== 'parse' && ruleName !== 'parsePath') {
      // Build the raw parser to access all rules
      const rawParser = sparql11ParserBuilder.build({
        tokenVocabulary: lex.sparql11LexerBuilder.tokenVocabulary,
        queryPreProcessor: sparqlCodepointEscape,
      });

      // Check if the rule exists
      const anyParser: any = rawParser;
      if (typeof anyParser[ruleName] !== 'function') {
        exitWithError(`Unknown rule: ${ruleName}. Use --help to see available options.`);
        return;
      }

      // Complete the context
      const astFactoryModule = await import('@traqula/rules-sparql-1-1');
      const fullContext = {
        astFactory: defaultContext.astFactory ??
          new astFactoryModule.AstFactory({ tracksSourceLocation: false }),
        baseIRI: defaultContext.baseIRI,
        prefixes: { ...defaultContext.prefixes },
        parseMode: new Set([ 'canParseVars', 'canCreateBlankNodes' ]),
        skipValidation: defaultContext.skipValidation ?? false,
      };

      ast = anyParser[ruleName](input, fullContext);
    } else {
      // Use the convenience Parser class for standard parsing
      const parser = new Parser({ defaultContext });

      if (ruleName === 'parsePath') {
        ast = parser.parsePath(input);
      } else {
        ast = parser.parse(input);
      }
    }

    // Output JSON
    writeOutput(JSON.stringify(ast, null, 2));
  } catch (error: any) {
    exitWithError(error.message || String(error));
  }
}

main().catch((error: Error) => {
  exitWithError(error.message || String(error));
});
