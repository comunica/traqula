#!/usr/bin/env node
import { exitWithError, readInput, writeOutput } from '@traqula/cli-utils';
import { Generator } from '@traqula/generator-sparql-1-2';
import { Parser } from '@traqula/parser-sparql-1-2';
import minimist from 'minimist';
import { toAlgebra, toAst } from '../dist/esm/lib/index.js';

const usage = `Usage: traqula-sparql-algebra-1-2 [options] [input]

Convert between SPARQL 1.2 query strings, AST, and SPARQL algebra.

Options:
  -h, --help                Show this help message
  -f, --file <path>        Read input from file instead of argument or stdin
  --to-algebra             Convert SPARQL query or AST to algebra (default)
  --to-ast                 Convert algebra to AST
  --to-sparql              Convert algebra to SPARQL query string
  --quads                  Use quads instead of triples (embeds GRAPH into patterns)
  --blank-to-variable      Convert blank nodes to variables

Input modes:
  - Default (--to-algebra): Parse SPARQL string or AST JSON → output algebra JSON
  - --to-ast: Parse algebra JSON → output AST JSON
  - --to-sparql: Parse algebra JSON → output SPARQL string

Examples:
  # SPARQL to algebra
  traqula-sparql-algebra-1-2 "SELECT * WHERE { ?s ?p ?o }"
  
  # AST to algebra
  cat ast.json | traqula-sparql-algebra-1-2
  
  # Algebra to AST
  cat algebra.json | traqula-sparql-algebra-1-2 --to-ast
  
  # Algebra to SPARQL
  cat algebra.json | traqula-sparql-algebra-1-2 --to-sparql
`;

async function main(): Promise<void> {
  const args = minimist(process.argv.slice(2), {
    boolean: [ 'help', 'to-algebra', 'to-ast', 'to-sparql', 'quads', 'blank-to-variable' ],
    string: [ 'file' ],
    alias: { h: 'help', f: 'file' },
  });

  if (args.help) {
    process.stderr.write(`${usage}\n`);
    process.exit(0);
  }

  try {
    // Determine mode
    const toAstMode = args['to-ast'];
    const toSparqlMode = args['to-sparql'];
    // Default
    const toAlgebraMode = !toAstMode && !toSparqlMode;

    // Read input
    const input = await readInput(args.file ?? args._[0], Boolean(args.file));
    if (!input.trim()) {
      exitWithError('No input provided');
    }

    if (toAlgebraMode) {
      // Input can be SPARQL string or AST JSON
      let ast: any;

      // Try to parse as JSON first (AST)
      try {
        ast = JSON.parse(input);
      } catch {
        // Not JSON, treat as SPARQL string
        const parser = new Parser();
        ast = parser.parse(input);
      }

      // Convert to algebra
      const algebra = toAlgebra(ast, {
        quads: args.quads,
        blankToVariable: args['blank-to-variable'],
      });

      writeOutput(JSON.stringify(algebra, null, 2));
    } else if (toAstMode) {
      // Parse algebra JSON
      let algebra: any;
      try {
        algebra = JSON.parse(input);
      } catch (error: any) {
        exitWithError(`Invalid JSON input: ${error.message}`);
      }

      // Convert to AST
      const ast = toAst(algebra);
      writeOutput(JSON.stringify(ast, null, 2));
    } else if (toSparqlMode) {
      // Parse algebra JSON
      let algebra: any;
      try {
        algebra = JSON.parse(input);
      } catch (error: any) {
        exitWithError(`Invalid JSON input: ${error.message}`);
      }

      // Convert to AST then to SPARQL
      const ast = toAst(algebra);
      const generator = new Generator();
      const sparql = generator.generate(ast);
      writeOutput(sparql);
    }
  } catch (error: any) {
    exitWithError(error.message || String(error));
  }
}

main().catch((error: Error) => {
  exitWithError(error.message || String(error));
});
