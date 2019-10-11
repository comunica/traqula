import { Term } from 'rdf-js';

export interface Wildcard {
    /**
     * Contains the constant 'Wildcard'.
     */
    termType: 'Wildcard';

    /**
     * The fixed value '*'.
     */
    value: '*';

    /**
     * @param other The term to compare with.
     * @return True if and only if other Term is a Wildcard.
     */
    equals(other: Term | Wildcard): boolean;
}