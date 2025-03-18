grammar Test;

compilationUnit
  : gramB gramD gramF EOF
  ;
gramB
  : gramC ( gramE gramD )*;
gramD
  : 'D'? ;
gramC: 'C' ;
gramE: 'E' ;
gramF: 'F' ;
