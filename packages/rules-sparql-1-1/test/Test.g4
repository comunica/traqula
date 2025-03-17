grammar Test;

compilationUnit
  : gramA gramB gramD gramF EOF
  ;


gramB
  : gramC ( gramD gramE )*;

gramD
  : 'D'
  |
  ;

gramA: 'A' ;

gramC: 'C' ;

gramE: 'E' ;

gramF: 'F' ;
