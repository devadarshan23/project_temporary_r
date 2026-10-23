G978's SHAPE. In a BASIC regular expression the escaped pipe is the OPERATOR
and a bare pipe is a literal, so the command below is an alternation and it
matches the very line it is written on:

    grep -rn 'alphaLib\|betaLib' bre.md

Read as a literal it would match nothing at all, and the finding would be
missed. That inversion is the whole reason `toJsRegex` exists.
