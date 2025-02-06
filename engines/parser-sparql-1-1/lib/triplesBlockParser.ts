import { Builder } from '@traqula/core';
import { gram } from '@traqula/rules-sparql-1-1';
import { objectListBuilder } from './objectListParser';

export const triplesBlockParserBuilder = Builder.createBuilder(<const> [
  gram.triplesBlock,
  gram.triplesSameSubjectPath,
  // VarOrTerm is included in the required ObjectList rule
  gram.propertyListPathNotEmpty,
  gram.triplesNodePath,
  gram.propertyListPath,
  // PropertyListNotEmpty
  gram.verbPath,
  gram.verbSimple,
  gram.objectListPath,
])
  .merge(objectListBuilder, <const> [])
  // Verb path
  .addMany(
    gram.path,
    gram.pathAlternative,
    gram.pathSequence,
    gram.pathEltOrInverse,
    gram.pathElt,
    gram.pathPrimary,
    gram.pathMod,
    gram.pathNegatedPropertySet,
    gram.pathOneInPropertySet,
    // ObjectListPath
    gram.objectPath,
    gram.graphNodePath,
    gram.collectionPath,
    gram.blankNodePropertyListPath,
  );
