#! /usr/bin/env node

import * as minimist from 'minimist';
import translate from '../lib/sparqlAlgebra';
import {toSparql} from '../lib/sparql';
import Util from "../test/util";

const args = minimist(process.argv.slice(2), {
    boolean: ['q', 'r'],
    alias: { q: 'quads', r: 'reverse' }
});

if (args.h || args.help || args._.length !== 1)
{
    console.error('usage: ./sparqlalgebrajs [-q/--quads] "SELECT * WHERE { ?x ?y ?z}"');
    console.error('options:');
    console.error('  -h --help  : Show this output.');
    console.error('  -q --quads : Apply GRAPH statements to convert triples to quads.');
    console.error('  -r --reverse  : Convert algebra to SPARQL.');
    process.exit((args.h || args.help) ? 0 : 1);
}

if (args.r || args.reverse)
{
    console.log(toSparql(JSON.parse(args._[0])));
}
else
{
    console.log(JSON.stringify(Util.objectify(translate(args._[0], { quads: args.q })), null, 2));
}