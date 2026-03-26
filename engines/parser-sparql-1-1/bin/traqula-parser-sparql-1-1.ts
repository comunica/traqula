#!/usr/bin/env node
import {
  getFlagAsBoolean,
  getFlagAsString,
  getFlagAsStrings,
  parseCliArgs,
  parsePrefixMappings,
  readTextInput,
  runJsonlService,
  writeJsonOutput,
} from '@traqula/cli-utils';
import type { SparqlContext } from '@traqula/rules-sparql-1-1';
import { createParserCliRuntime, handleParserCliRequest } from '../lib/cli.js';

function printHelp(): void {
  process.stdout.write(`Usage: traqula-parser-sparql-1-1 [options]\n\n` +
    `Parse SPARQL 1.1 input into a Traqula AST (JSON).\n\n` +
    `Options:\n` +
    `  -i, --input <path>          Read query text from file (defaults to stdin)\n` +
    `  -o, --output <path>         Write JSON output to file (defaults to stdout)\n` +
    `      --path                  Parse input as a SPARQL path expression\n` +
    `      --base-iri <iri>        Set default base IRI\n` +
    `      --prefix <pfx=iri>      Set default prefix mapping (repeatable)\n` +
    `      --skip-validation       Skip parser validation checks\n` +
    `      --allow-vars            Enable variable parsing mode\n` +
    `      --allow-blank-nodes     Enable blank node creation mode\n` +
    `      --pretty                Pretty-print JSON output\n` +
    `      --service [jsonl]       Run JSONL service mode over stdio\n` +
    `  -h, --help                  Show this help text\n\n` +
    `Service request format:\n` +
    `  {"id":"1","query":"SELECT * WHERE { ?s ?p ?o }","path":false,"context":{...}}\n`);
}

function createDefaultContext(args: ReturnType<typeof parseCliArgs>): Partial<SparqlContext> {
  const parseMode = new Set<string>();
  if (getFlagAsBoolean(args, 'allow-vars')) {
    parseMode.add('canParseVars');
  }
  if (getFlagAsBoolean(args, 'allow-blank-nodes')) {
    parseMode.add('canCreateBlankNodes');
  }

  const prefixes = parsePrefixMappings(getFlagAsStrings(args, 'prefix'));
  const context: Partial<SparqlContext> = {
    baseIRI: getFlagAsString(args, 'base-iri'),
    skipValidation: getFlagAsBoolean(args, 'skip-validation'),
    prefixes,
  };
  if (parseMode.size > 0) {
    context.parseMode = parseMode;
  }
  return context;
}

async function run(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (getFlagAsBoolean(args, 'help', 'h')) {
    printHelp();
    return;
  }

  const runtime = createParserCliRuntime(createDefaultContext(args));
  if (getFlagAsBoolean(args, 'service')) {
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

  const query = await readTextInput(getFlagAsString(args, 'input', 'i'));
  const output = handleParserCliRequest(runtime, {
    query,
    path: getFlagAsBoolean(args, 'path'),
  });
  await writeJsonOutput(output, getFlagAsBoolean(args, 'pretty'), getFlagAsString(args, 'output', 'o'));
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unknown error'}\n`);
  process.exitCode = 1;
});
