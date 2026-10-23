<!--
M1 — `grep -c` counts LINES, not matches, and `grep -o` counts matches, not
rows. A row is a pipe, a space, a G, digits, a space and a pipe AT COLUMN 0, and
nothing else is one. Below the fence-free body of this file holds exactly TWO
rows while carrying THREE lines that contain that pattern and FOUR occurrences
of it in total. Each of the three counts is a different number and only one of
them is right.

(This header deliberately spells the pattern out in words rather than quoting
it, so the counts asserted against this file are counts of the body.)
-->

| G186 | one row, two `| G` patterns — superseded by | G187 | named in this same cell |
| G188 | a plain row |
notes | G189 | this line has the pattern but does not start with it, so it is not a row
