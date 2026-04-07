#!/usr/bin/env node
import {
  parsePrefixMappings,
  readTextInput,
  runJsonlService,
  writeJsonOutput,
} from '@traqula/cli-utils';
import type { SparqlContext } from '@traqula/rules-sparql-1-1';
import { Command } from 'commander';
import { createParserCliRuntime, handleParserCliRequest } from '../lib/cli.js';

function collectStrings(val: string, prev: string[]): string[] {
  return [ ...prev, val ];
}

const program = new Command()
  .name('traqula-parser-sparql-1-1')
  .description('Parse SPARQL 1.1 input into a Traqula AST (JSON).')
  .option('-i, --input <path>', 'Read query text from file (defaults to stdin)')
  .option('-o, --output <path>', 'Write JSON output to file (defaults to stdout)')
  .option('--path', 'Parse input as a SPARQL path expression')
  .option('--base-iri <iri>', 'Set default base IRI')
  .option('--prefix <pfx=iri>', 'Set default prefix mapping (repeatable)', collectStrings, <string[]> [])
  .option('--skip-validation', 'Skip parser validation checks')
  .option('--allow-vars', 'Enable variable parsing mode')
  .option('--allow-blank-nodes', 'Enable blank node creation mode')
  .option('--pretty', 'Pretty-print JSON output')
  .option('--service', 'Run JSONL service mode over stdio')
  .addHelpText('after', `
Service request format:
  {"id":"1","query":"SELECT * WHERE { ?s ?p ?o }","path":false,"context":{...}}`);

interface Options {
  input?: string;
  output?: string;
  path?: boolean;
  baseIri?: string;
  prefix: string[];
  skipValidation?: boolean;
  allowVars?: boolean;
  allowBlankNodes?: boolean;
  pretty?: boolean;
  service?: boolean;
}

function createDefaultContext(opts: Options): Partial<SparqlContext> {
  const parseMode = new Set<string>();
  if (opts.allowVars) {
    parseMode.add('canParseVars');
  }
  if (opts.allowBlankNodes) {
    parseMode.add('canCreateBlankNodes');
  }

  const context: Partial<SparqlContext> = {
    baseIRI: opts.baseIri,
    skipValidation: opts.skipValidation,
    prefixes: parsePrefixMappings(opts.prefix),
  };
  if (parseMode.size > 0) {
    context.parseMode = parseMode;
  }
  return context;
}

program.action(async(opts: Options) => {
  const runtime = createParserCliRuntime(createDefaultContext(opts));

  if (opts.service) {
    await runJsonlService((request: unknown) => {
      if (request === null || typeof request !== 'object') {
        throw new Error('Service request must be a JSON object');
      }
      const data = <{ query?: unknown; path?: unknown; context?: unknown }> request;
      if (typeof data.query !== 'string') {
        throw new TypeError('Missing string property: query');
      }
      return handleParserCliRequest(runtime, {
        query: data.query,
        path: Boolean(data.path),
        context: <Partial<SparqlContext> | undefined> data.context,
      });
    });
    return;
  }

  const query = await readTextInput(opts.input);
  const output = handleParserCliRequest(runtime, {
    query,
    path: opts.path ?? false,
  });
  await writeJsonOutput(output, opts.pretty ?? false, opts.output);
});

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unknown error'}\n`);
  process.exitCode = 1;
});
