#!/usr/bin/env node
import type { ContextConfigs } from '@traqula/algebra-transformations-1-1';
import type { Algebra } from '@traqula/algebra-transformations-1-1';
import {
  getFlagAsBoolean,
  getFlagAsString,
  getFlagAsStrings,
  parseCliArgs,
  parsePrefixMappings,
  readJsonInput,
  runJsonlService,
  writeJsonOutput,
} from '@traqula/cli-utils';
import type { SparqlQuery } from '@traqula/rules-sparql-1-1';
import { createAlgebraCliRuntime, handleAlgebraCliRequest } from '../lib/cli.js';

function printHelp(): void {
  process.stdout.write(`Usage: traqula-algebra-sparql-1-1 [options]\n\n` +
    `Translate between Traqula SPARQL AST JSON and SPARQL algebra JSON.\n\n` +
    `Options:\n` +
    `  -i, --input <path>          Read JSON input from file (defaults to stdin)\n` +
    `  -o, --output <path>         Write JSON output to file (defaults to stdout)\n` +
    `      --from <ast|algebra>    Input format (default: ast)\n` +
    `      --quads                 toAlgebra: convert patterns to quads\n` +
    `      --blank-to-variable     toAlgebra: rewrite blank nodes to variables\n` +
    `      --base-iri <iri>        toAlgebra: base IRI for relative resolution\n` +
    `      --prefix <pfx=iri>      toAlgebra: predefined prefixes (repeatable)\n` +
    `      --pretty                Pretty-print JSON output\n` +
    `      --service [jsonl]       Run JSONL service mode over stdio\n` +
    `  -h, --help                  Show this help text\n\n` +
    `Service request format:\n` +
    `  {"id":"1","mode":"toAlgebra","input":{...},"options":{"quads":false}}\n`);
}

function createToAlgebraOptions(args: ReturnType<typeof parseCliArgs>): ContextConfigs {
  const prefixes = parsePrefixMappings(getFlagAsStrings(args, 'prefix'));
  const options: ContextConfigs = {
    quads: getFlagAsBoolean(args, 'quads'),
    blankToVariable: getFlagAsBoolean(args, 'blank-to-variable'),
    baseIRI: getFlagAsString(args, 'base-iri'),
    prefixes,
  };
  return options;
}

function parseMode(args: ReturnType<typeof parseCliArgs>): 'toAlgebra' | 'toAst' {
  const inputFormat = getFlagAsString(args, 'from');
  if (!inputFormat || inputFormat === 'ast') {
    return 'toAlgebra';
  }
  if (inputFormat === 'algebra') {
    return 'toAst';
  }
  throw new Error(`Invalid value for --from: ${inputFormat}`);
}

async function run(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (getFlagAsBoolean(args, 'help', 'h')) {
    printHelp();
    return;
  }

  const runtime = createAlgebraCliRuntime();
  if (getFlagAsBoolean(args, 'service')) {
    await runJsonlService((request: unknown) => {
      if (request === null || typeof request !== 'object') {
        throw new Error('Service request must be a JSON object');
      }
      const data = request as { mode?: unknown; input?: unknown; options?: unknown };
      if (data.mode !== 'toAlgebra' && data.mode !== 'toAst') {
        throw new Error('Service request must include mode: toAlgebra | toAst');
      }
      if (data.input === undefined) {
        throw new Error('Service request must include property: input');
      }
      return handleAlgebraCliRequest(runtime, {
        mode: data.mode,
        input: data.input as SparqlQuery | Algebra.Operation,
        options: data.options as ContextConfigs | undefined,
      });
    });
    return;
  }

  const mode = parseMode(args);
  const input = await readJsonInput<SparqlQuery | Algebra.Operation>(getFlagAsString(args, 'input', 'i'));
  const output = handleAlgebraCliRequest(runtime, {
    mode,
    input,
    options: mode === 'toAlgebra' ? createToAlgebraOptions(args) : undefined,
  });

  await writeJsonOutput(output, getFlagAsBoolean(args, 'pretty'), getFlagAsString(args, 'output', 'o'));
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unknown error'}\n`);
  process.exitCode = 1;
});
