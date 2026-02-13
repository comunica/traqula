#!/usr/bin/env node
import { readInput, formatJson, writeOutput, exitWithError, printUsage } from '@traqula/cli-utils';
import minimist from 'minimist';
import { Parser } from '../dist/esm/lib/index.js';

const usage = `Usage: traqula-sparql-parser-1-1 [options] [query]

Parse SPARQL 1.1 queries to JSON AST.

Options:
  -h, --help                Show this help message
  -f, --file <path>        Read query from file instead of argument or stdin
  --path                    Parse as a property path (uses parsePath instead of parse)
  --base <iri>             Set base IRI
  --prefix <prefix=iri>    Add prefix (can be used multiple times)
  --skip-validation        Skip validation during parsing
  --track-location         Track source locations in AST

Input:
  - Pass query as argument: traqula-sparql-parser-1-1 "SELECT * WHERE { ?s ?p ?o }"
  - Read from file: traqula-sparql-parser-1-1 -f query.sparql
  - Read from stdin: cat query.sparql | traqula-sparql-parser-1-1

Output:
  JSON AST is written to stdout
`;

async function main(): Promise<void> {
  const args = minimist(process.argv.slice(2), {
    boolean: [ 'help', 'path', 'skip-validation', 'track-location' ],
    string: [ 'file', 'base', 'prefix' ],
    alias: { h: 'help', f: 'file' },
  });

  if (args.help) {
    printUsage(usage);
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

    // Create parser - use partial context (AstFactory will be created by default)
    const defaultContext: any = {
      baseIRI: args.base,
      prefixes,
      skipValidation: args['skip-validation'],
    };

    const parser = new Parser({ defaultContext });

    // Parse based on mode
    let ast: any;
    if (args.path) {
      ast = parser.parsePath(input);
    } else {
      ast = parser.parse(input);
    }

    // Output JSON
    writeOutput(formatJson(ast));
  } catch (error: any) {
    exitWithError(error.message || String(error));
  }
}

main().catch((error: Error) => {
  exitWithError(error.message || String(error));
});
