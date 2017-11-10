#! /usr/bin/env node

import * as minimist from 'minimist';
import { translate } from '../lib/sparqlAlgebra';

const args = minimist(process.argv.slice(2), {
    boolean: ['q'],
    alias: { q: 'quads' }
});

if (args.h || args.help || args._.length !== 1)
{
    console.error('usage: ./sparqlalgebrajs [-q/--quads] "SELECT * WHERE { ?x ?y ?z}"');
    console.error('options:');
    console.error('  -h --help  : Show this output.');
    console.error('  -q --quads : Apply GRAPH statements to convert triples to quads.');
    process.exit((args.h || args.help) ? 0 : 1);
}

console.log(JSON.stringify(translate(args._[0], args.q), null, 2));