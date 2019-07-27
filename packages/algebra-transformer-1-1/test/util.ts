
import * as util from 'util';
import {Algebra} from "../index";
import * as LibUtil from "../lib/util";
import Factory from "../lib/factory";
import * as RDF from "rdf-js";
import {blankNode, variable} from "@rdfjs/data-model";

export default class Util
{
    static inspect (obj: any): void
    {
        console.log(util.inspect(Util.objectify(obj), { depth: null, breakLength: 120 }));
    };

    // we need this because the RDF.js types dont output correctly when using JSON.stringify
    static objectify (algebra: any): any
    {
        if (algebra.termType)
        {
            let result: any = { termType: algebra.termType, value: algebra.value };
            if (algebra.language)
                result.language = algebra.language;
            if (algebra.datatype)
                result.datatype = Util.objectify(algebra.datatype);
            return result;
        }
        if (Array.isArray(algebra))
            return algebra.map(Util.objectify);
        if (algebra === Object(algebra))
        {
            let result: any = {};
            for (let key of Object.keys(algebra))
                result[key] = Util.objectify(algebra[key]);
            return result;
        }
        return algebra;
    }

    static getCanonicalizerInstance(){
        return new Canonicalizer();
    }
}

class Canonicalizer {
    constructor(){
        this.blankId = 0;
    }

    public blankId: number;
    public genValue() {
        return "value_" + this.blankId++;
    }

    /**
     * Replaces values of BlankNodes in a query with newly generated names.
     * @param res
     * @param replaceVariables
     */
    public canonicalizeQuery(res: Algebra.Operation, replaceVariables: boolean) : Algebra.Operation {
        this.blankId = 0;
        let nameMapping: { [bLabel: string]: string } = {};
        return LibUtil.default.mapOperation(res, {
            'path': (op: Algebra.Path, factory: Factory) => {
                return {
                    result: factory.createPath(
                        this.replaceValue(op.subject, nameMapping, replaceVariables),
                        op.predicate,
                        this.replaceValue(op.object, nameMapping, replaceVariables),
                        this.replaceValue(op.graph, nameMapping, replaceVariables),
                    ),
                    recurse: true,
                };
            },
            'pattern': (op: Algebra.Pattern, factory: Factory) => {
                return {
                    result: factory.createPattern(
                        this.replaceValue(op.subject, nameMapping, replaceVariables),
                        this.replaceValue(op.predicate, nameMapping, replaceVariables),
                        this.replaceValue(op.object, nameMapping, replaceVariables),
                        this.replaceValue(op.graph, nameMapping, replaceVariables),
                    ),
                    recurse: true,
                };
            },
            'construct': (op: Algebra.Construct, factory) => {
                // Blank nodes in CONSTRUCT templates must be maintained
                return {
                    result: factory.createConstruct(op.input, op.template),
                    recurse: true,
                };
            },
        });
    }

    public replaceValue(term: RDF.Term, nameMapping: {[bLabel: string]: string}
        , replaceVars: boolean) {
        if (term.termType !== "BlankNode" && (term.termType !== "Variable" || ! replaceVars)) return term;

        let generateTerm = term.termType === "Variable" ? variable : blankNode;

        let val = nameMapping[term.value];
        if (! val) {
            val = this.genValue();
            nameMapping[term.value] = val;
        }
        return generateTerm(val);
    }
}
