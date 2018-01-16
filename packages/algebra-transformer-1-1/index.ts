import translate from'./lib/sparqlAlgebra';
import * as Algebra from'./lib/algebra';
import Factory from './lib/Factory';
// import {toSparql, toSparqlJs} from'./lib/sparql';

export { translate, Algebra, Factory };

// let algebra = translate(
//     `PREFIX : <http://www.example.org>
//                         PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
//                         SELECT ?L
//                         WHERE {
//                             ?O :hasItem [ rdfs:label ?L ] .
//                             {
//                                 SELECT DISTINCT ?O
//                                 WHERE { ?O a :Order }
//                                 ORDER BY ?O
//                                 LIMIT 2
//                             }
//                         } ORDER BY ?L`
// );
// console.log(JSON.stringify(algebra, null, 2));
// console.log(JSON.stringify(toSparqlJs(algebra), null, 2));
// console.log(toSparql(algebra));