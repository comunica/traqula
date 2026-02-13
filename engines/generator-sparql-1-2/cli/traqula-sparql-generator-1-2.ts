#!/usr/bin/env node
import { readInput, writeOutput, exitWithError, printUsage } from '@traqula/cli-utils';
import minimist from 'minimist';
import { Generator } from '../dist/esm/lib/index.js';

const usage = `Usage: traqula-sparql-generator-1-2 [options] [ast-json]

Generate SPARQL 1.2 query strings from JSON AST.

Options:
  -h, --help                Show this help message
  -f, --file <path>        Read AST JSON from file instead of argument or stdin
  --path                    Generate from a property path AST (uses generatePath instead of generate)
  --indent <num>           Set indentation increment (default: 2)
  --newline <str>          Set newline alternative for compact output (default: ' ')

Input:
  - Pass AST JSON as argument: traqula-sparql-generator-1-2 '{"type":"query",...}'
  - Read from file: traqula-sparql-generator-1-2 -f ast.json
  - Read from stdin: cat ast.json | traqula-sparql-generator-1-2

Output:
  SPARQL query string is written to stdout
`;

async function main(): Promise<void> {
  const args = minimist(process.argv.slice(2), {
    boolean: [ 'help', 'path' ],
    string: [ 'file', 'indent', 'newline' ],
    alias: { h: 'help', f: 'file' },
  });

  if (args.help) {
    printUsage(usage);
    process.exit(0);
  }

  try {
    // Read input
    const input = await readInput(args.file ?? args._[0], Boolean(args.file));
    if (!input.trim()) {
      exitWithError('No input provided');
    }

    // Parse JSON AST
    let ast: any;
    try {
      ast = JSON.parse(input);
    } catch (error: any) {
      exitWithError(`Invalid JSON input: ${error.message}`);
    }

    // Create generator with context
    const context: any = {};
    if (args.indent !== undefined) {
      context.indentInc = Number.parseInt(args.indent, 10);
      if (Number.isNaN(context.indentInc)) {
        exitWithError(`Invalid indent value: ${args.indent}`);
      }
    }
    if (args.newline !== undefined) {
      context[Symbol.for('traqula:newlineAlternative')] = args.newline;
    }

    const generator = new Generator(context);

    // Generate based on mode
    let output: string;
    if (args.path) {
      output = generator.generatePath(ast);
    } else {
      output = generator.generate(ast);
    }

    // Output SPARQL
    writeOutput(output);
  } catch (error: any) {
    exitWithError(error.message || String(error));
  }
}

main().catch((error: Error) => {
  exitWithError(error.message || String(error));
});
