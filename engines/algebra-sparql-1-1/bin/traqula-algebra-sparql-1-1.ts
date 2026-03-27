#!/usr/bin/env node
import type { Algebra, ContextConfigs } from '@traqula/algebra-transformations-1-1';
import {
  parsePrefixMappings,
  readJsonInput,
  runJsonlService,
  writeJsonOutput,
} from '@traqula/cli-utils';
import type { SparqlQuery } from '@traqula/rules-sparql-1-1';
import { Command } from 'commander';
import { createAlgebraCliRuntime, handleAlgebraCliRequest } from '../lib/cli.js';

function collectStrings(val: string, prev: string[]): string[] {
  return [ ...prev, val ];
}

const program = new Command()
  .name('traqula-algebra-sparql-1-1')
  .description('Translate between Traqula SPARQL AST JSON and SPARQL algebra JSON.')
  .option('-i, --input <path>', 'Read JSON input from file (defaults to stdin)')
  .option('-o, --output <path>', 'Write JSON output to file (defaults to stdout)')
  .option('--from <ast|algebra>', 'Input format (default: ast)', 'ast')
  .option('--quads', 'toAlgebra: convert patterns to quads')
  .option('--blank-to-variable', 'toAlgebra: rewrite blank nodes to variables')
  .option('--base-iri <iri>', 'toAlgebra: base IRI for relative resolution')
  .option('--prefix <pfx=iri>', 'toAlgebra: predefined prefixes (repeatable)', collectStrings, <string[]> [])
  .option('--pretty', 'Pretty-print JSON output')
  .option('--service', 'Run JSONL service mode over stdio')
  .addHelpText('after', `
Service request format:
  {"id":"1","mode":"toAlgebra","input":{...},"options":{"quads":false}}`);

interface Options {
  input?: string;
  output?: string;
  from: string;
  quads?: boolean;
  blankToVariable?: boolean;
  baseIri?: string;
  prefix: string[];
  pretty?: boolean;
  service?: boolean;
}

function parseFromOption(value: string): 'toAlgebra' | 'toAst' {
  if (value === 'ast') {
    return 'toAlgebra';
  }
  if (value === 'algebra') {
    return 'toAst';
  }
  throw new Error(`Invalid value for --from: ${value}. Expected 'ast' or 'algebra'`);
}

function createToAlgebraOptions(opts: Options): ContextConfigs {
  return {
    quads: opts.quads,
    blankToVariable: opts.blankToVariable,
    baseIRI: opts.baseIri,
    prefixes: parsePrefixMappings(opts.prefix),
  };
}

program.action(async(opts: Options) => {
  const runtime = createAlgebraCliRuntime();

  if (opts.service) {
    await runJsonlService((request: unknown) => {
      if (request === null || typeof request !== 'object') {
        throw new Error('Service request must be a JSON object');
      }
      const data = <{ mode?: unknown; input?: unknown; options?: unknown }> request;
      if (data.mode !== 'toAlgebra' && data.mode !== 'toAst') {
        throw new Error('Service request must include mode: toAlgebra | toAst');
      }
      if (data.input === undefined) {
        throw new Error('Service request must include property: input');
      }
      if (data.mode === 'toAlgebra') {
        return handleAlgebraCliRequest(runtime, {
          mode: 'toAlgebra',
          input: <SparqlQuery> data.input,
          options: <ContextConfigs | undefined> data.options,
        });
      }
      return handleAlgebraCliRequest(runtime, {
        mode: 'toAst',
        input: <Algebra.Operation> data.input,
      });
    });
    return;
  }

  const mode = parseFromOption(opts.from);
  const input = await readJsonInput<SparqlQuery | Algebra.Operation>(opts.input);
  const output = mode === 'toAlgebra' ?
    handleAlgebraCliRequest(runtime, {
      mode: 'toAlgebra',
      input: <SparqlQuery> input,
      options: createToAlgebraOptions(opts),
    }) :
    handleAlgebraCliRequest(runtime, {
      mode: 'toAst',
      input: <Algebra.Operation> input,
    });

  await writeJsonOutput(output, opts.pretty ?? false, opts.output);
});

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unknown error'}\n`);
  process.exitCode = 1;
});
