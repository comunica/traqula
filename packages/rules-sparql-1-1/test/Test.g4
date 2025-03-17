grammar Test;

compilationUnit
  : gramB gramD gramF EOF
  ;


gramB
  : gramC ( gramD gramE )*;

gramD
  : 'D'?
  ;

gramC: 'C' ;

gramE: 'E' ;

gramF: 'F' ;
