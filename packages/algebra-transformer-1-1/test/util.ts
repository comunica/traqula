
import * as util from 'util';

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
}