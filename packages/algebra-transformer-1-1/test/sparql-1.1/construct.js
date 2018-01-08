
const _ = require('lodash');

const Util = require('../util');

const A = Util.Algebra;
const translate = Util.translate;

const AE = Util.algebraElement;
const T = Util.triple;

// https://www.w3.org/2009/sparql/implementations/
// https://www.w3.org/2009/sparql/docs/tests/
describe('SPARQL 1.1 constructs', () => {
    it('constructwhere01 - CONSTRUCT WHERE', () => {
        let sparql = `PREFIX : <http://example.org/>
                      CONSTRUCT WHERE { ?s ?p ?o}`;
        let algebra = translate(sparql);
        let expected = {
            "type": "construct",
            "input": {
                "type": "bgp",
                "patterns": [
                    {
                        "type": "pattern",
                        "subject": {
                            "termType": "Variable",
                            "value": "s"
                        },
                        "predicate": {
                            "termType": "Variable",
                            "value": "p"
                        },
                        "object": {
                            "termType": "Variable",
                            "value": "o"
                        },
                        "graph": {
                            "termType": "DefaultGraph",
                            "value": ""
                        }
                    }
                ]
            },
            "template": [
                {
                    "type": "pattern",
                    "subject": {
                        "termType": "Variable",
                        "value": "s"
                    },
                    "predicate": {
                        "termType": "Variable",
                        "value": "p"
                    },
                    "object": {
                        "termType": "Variable",
                        "value": "o"
                    },
                    "graph": {
                        "termType": "DefaultGraph",
                        "value": ""
                    }
                }
            ]
        };
        Util.compareAlgebras(expected, algebra);
    });

    it('constructwhere02 - CONSTRUCT WHERE', () => {
        let sparql = `PREFIX : <http://example.org/>
                      CONSTRUCT WHERE { :s1 :p ?o . ?s2 :p ?o }`;
        let algebra = translate(sparql);
        let expected = {
            "type": "construct",
            "input": {
                "type": "bgp",
                "patterns": [
                    {
                        "type": "pattern",
                        "subject": {
                            "termType": "NamedNode",
                            "value": "http://example.org/s1"
                        },
                        "predicate": {
                            "termType": "NamedNode",
                            "value": "http://example.org/p"
                        },
                        "object": {
                            "termType": "Variable",
                            "value": "o"
                        },
                        "graph": {
                            "termType": "DefaultGraph",
                            "value": ""
                        }
                    },
                    {
                        "type": "pattern",
                        "subject": {
                            "termType": "Variable",
                            "value": "s2"
                        },
                        "predicate": {
                            "termType": "NamedNode",
                            "value": "http://example.org/p"
                        },
                        "object": {
                            "termType": "Variable",
                            "value": "o"
                        },
                        "graph": {
                            "termType": "DefaultGraph",
                            "value": ""
                        }
                    }
                ]
            },
            "template": [
                {
                    "type": "pattern",
                    "subject": {
                        "termType": "NamedNode",
                        "value": "http://example.org/s1"
                    },
                    "predicate": {
                        "termType": "NamedNode",
                        "value": "http://example.org/p"
                    },
                    "object": {
                        "termType": "Variable",
                        "value": "o"
                    },
                    "graph": {
                        "termType": "DefaultGraph",
                        "value": ""
                    }
                },
                {
                    "type": "pattern",
                    "subject": {
                        "termType": "Variable",
                        "value": "s2"
                    },
                    "predicate": {
                        "termType": "NamedNode",
                        "value": "http://example.org/p"
                    },
                    "object": {
                        "termType": "Variable",
                        "value": "o"
                    },
                    "graph": {
                        "termType": "DefaultGraph",
                        "value": ""
                    }
                }
            ]
        };
        Util.compareAlgebras(expected, algebra);
    });

    it('constructwhere03 - CONSTRUCT WHERE', () => {
        let sparql = `PREFIX : <http://example.org/>
                      CONSTRUCT WHERE { :s2 :p ?o1, ?o2 }`;
        let algebra = translate(sparql);
        let expected = {
            "type": "construct",
            "input": {
                "type": "bgp",
                "patterns": [
                    {
                        "type": "pattern",
                        "subject": {
                            "termType": "NamedNode",
                            "value": "http://example.org/s2"
                        },
                        "predicate": {
                            "termType": "NamedNode",
                            "value": "http://example.org/p"
                        },
                        "object": {
                            "termType": "Variable",
                            "value": "o1"
                        },
                        "graph": {
                            "termType": "DefaultGraph",
                            "value": ""
                        }
                    },
                    {
                        "type": "pattern",
                        "subject": {
                            "termType": "NamedNode",
                            "value": "http://example.org/s2"
                        },
                        "predicate": {
                            "termType": "NamedNode",
                            "value": "http://example.org/p"
                        },
                        "object": {
                            "termType": "Variable",
                            "value": "o2"
                        },
                        "graph": {
                            "termType": "DefaultGraph",
                            "value": ""
                        }
                    }
                ]
            },
            "template": [
                {
                    "type": "pattern",
                    "subject": {
                        "termType": "NamedNode",
                        "value": "http://example.org/s2"
                    },
                    "predicate": {
                        "termType": "NamedNode",
                        "value": "http://example.org/p"
                    },
                    "object": {
                        "termType": "Variable",
                        "value": "o1"
                    },
                    "graph": {
                        "termType": "DefaultGraph",
                        "value": ""
                    }
                },
                {
                    "type": "pattern",
                    "subject": {
                        "termType": "NamedNode",
                        "value": "http://example.org/s2"
                    },
                    "predicate": {
                        "termType": "NamedNode",
                        "value": "http://example.org/p"
                    },
                    "object": {
                        "termType": "Variable",
                        "value": "o2"
                    },
                    "graph": {
                        "termType": "DefaultGraph",
                        "value": ""
                    }
                }
            ]
        };
        Util.compareAlgebras(expected, algebra);
    });

    it('constructwhere03 - CONSTRUCT WHERE', () => {
        let sparql = `PREFIX : <http://example.org/>
                      CONSTRUCT WHERE { :s2 :p ?o1, ?o2 }`;
        let algebra = translate(sparql);
        let expected = {
            "type": "construct",
            "input": {
                "type": "bgp",
                "patterns": [
                    {
                        "type": "pattern",
                        "subject": {
                            "termType": "NamedNode",
                            "value": "http://example.org/s2"
                        },
                        "predicate": {
                            "termType": "NamedNode",
                            "value": "http://example.org/p"
                        },
                        "object": {
                            "termType": "Variable",
                            "value": "o1"
                        },
                        "graph": {
                            "termType": "DefaultGraph",
                            "value": ""
                        }
                    },
                    {
                        "type": "pattern",
                        "subject": {
                            "termType": "NamedNode",
                            "value": "http://example.org/s2"
                        },
                        "predicate": {
                            "termType": "NamedNode",
                            "value": "http://example.org/p"
                        },
                        "object": {
                            "termType": "Variable",
                            "value": "o2"
                        },
                        "graph": {
                            "termType": "DefaultGraph",
                            "value": ""
                        }
                    }
                ]
            },
            "template": [
                {
                    "type": "pattern",
                    "subject": {
                        "termType": "NamedNode",
                        "value": "http://example.org/s2"
                    },
                    "predicate": {
                        "termType": "NamedNode",
                        "value": "http://example.org/p"
                    },
                    "object": {
                        "termType": "Variable",
                        "value": "o1"
                    },
                    "graph": {
                        "termType": "DefaultGraph",
                        "value": ""
                    }
                },
                {
                    "type": "pattern",
                    "subject": {
                        "termType": "NamedNode",
                        "value": "http://example.org/s2"
                    },
                    "predicate": {
                        "termType": "NamedNode",
                        "value": "http://example.org/p"
                    },
                    "object": {
                        "termType": "Variable",
                        "value": "o2"
                    },
                    "graph": {
                        "termType": "DefaultGraph",
                        "value": ""
                    }
                }
            ]
        };
        Util.compareAlgebras(expected, algebra);
    });

    it('constructwhere05 - CONSTRUCT WHERE (modified)', () => {
        let sparql = `PREFIX : <http://example.org/>
                      CONSTRUCT { ?s ?p ?o }
                      WHERE { ?s ?p ?o. FILTER ( ?o = :o1) }`;
        let algebra = translate(sparql);
        let expected = {
            "type": "construct",
            "input": {
                "type": "filter",
                "input": {
                    "type": "bgp",
                    "patterns": [
                        {
                            "type": "pattern",
                            "subject": {
                                "termType": "Variable",
                                "value": "s"
                            },
                            "predicate": {
                                "termType": "Variable",
                                "value": "p"
                            },
                            "object": {
                                "termType": "Variable",
                                "value": "o"
                            },
                            "graph": {
                                "termType": "DefaultGraph",
                                "value": ""
                            }
                        }
                    ]
                },
                "expression": {
                    "type": "expression",
                    "expressionType": "operator",
                    "operator": "=",
                    "args": [
                        {
                            "type": "expression",
                            "expressionType": "term",
                            "term": {
                                "termType": "Variable",
                                "value": "o"
                            }
                        },
                        {
                            "type": "expression",
                            "expressionType": "term",
                            "term": {
                                "termType": "NamedNode",
                                "value": "http://example.org/o1"
                            }
                        }
                    ]
                }
            },
            "template": [
                {
                    "type": "pattern",
                    "subject": {
                        "termType": "Variable",
                        "value": "s"
                    },
                    "predicate": {
                        "termType": "Variable",
                        "value": "p"
                    },
                    "object": {
                        "termType": "Variable",
                        "value": "o"
                    },
                    "graph": {
                        "termType": "DefaultGraph",
                        "value": ""
                    }
                }
            ]
        };
        Util.compareAlgebras(expected, algebra);
    });
});