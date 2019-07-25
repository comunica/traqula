
import * as util from 'util';
import {Algebra} from "../index";
import * as LibUtil from "../lib/util";
import Factory from "../lib/factory";
import * as RDF from "rdf-js";
import {blankNode} from "@rdfjs/data-model";

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
    public genBlankId() {
        return "g_" + this.blankId++;
    }

    /**
     * Replaces values of BlankNodes in a query with newly generated names.
     * @param res
     */
    public canonicalizeQuery(res: Algebra.Operation) : Algebra.Operation {
        this.blankId = 0;
        let nameMapping: { [bLabel: string]: string } = {};
        return LibUtil.default.mapOperation(res, {
            'path': (op: Algebra.Path, factory: Factory) => {
                return {
                    result: factory.createPath(
                        this.getNewBlank(op.subject, nameMapping),
                        op.predicate,
                        this.getNewBlank(op.object, nameMapping),
                        this.getNewBlank(op.graph, nameMapping),
                    ),
                    recurse: true,
                };
            },
            'pattern': (op: Algebra.Pattern, factory: Factory) => {
                return {
                    result: factory.createPattern(
                        this.getNewBlank(op.subject, nameMapping),
                        this.getNewBlank(op.predicate, nameMapping),
                        this.getNewBlank(op.object, nameMapping),
                        this.getNewBlank(op.graph, nameMapping),
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

    public getNewBlank(term: RDF.Term, nameMapping: {[bLabel: string]: string}): RDF.Term {
        if (term.termType !== "BlankNode") return term;
        else {
            if (nameMapping[term.value]) {
                return blankNode(nameMapping[term.value]);
            } else {
                return blankNode(this.genBlankId());
            }
        }
    }
}
