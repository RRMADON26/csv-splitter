const assert = require('assert');
const C = require('../js/csv.js');
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);

eq(C.parseRecord('a,b,c\n', ','), ['a', 'b', 'c']);
eq(C.parseRecord('a,b,c\r\n', ','), ['a', 'b', 'c']);
eq(C.parseRecord('a,,c', ','), ['a', '', 'c']);
eq(C.parseRecord(',', ','), ['', '']);
eq(C.parseRecord('a,', ','), ['a', '']);
eq(C.parseRecord('', ','), ['']);
eq(C.parseRecord('"a,b",c\n', ','), ['a,b', 'c']);
eq(C.parseRecord('"he said ""hi""",x', ','), ['he said "hi"', 'x']);
eq(C.parseRecord('1,"line1\nline2",3\n', ','), ['1', 'line1\nline2', '3']);
eq(C.parseRecord('"a",""\n', ','), ['a', '']);
eq(C.parseRecord('"a"\n', ','), ['a']);
eq(C.parseRecord('x;"y;z";w', ';'), ['x', 'y;z', 'w']);
eq(C.parseRecord('a\tb\t"c\td"', '\t'), ['a', 'b', 'c\td']);
eq(C.parseRecord('a"b,c', ','), ['a"b', 'c']);
eq(C.parseRecord('"unclosed,x\n', ','), ['unclosed,x']);

eq(C.formatRecord(['a', 'b,c', 'd"e', 'f\ng', ''], ','), 'a,"b,c","d""e","f\ng",');
eq(C.formatRecord(['a', 'b'], ';', true), '"a";"b"');
// round trip
const rows = [['id', 'name'], ['1', 'x,y'], ['2', 'q"r'], ['3', 'multi\nline'], ['4', ''], ['', '']];
for (const d of [',', ';', '\t', '|']) {
  for (const r of rows) eq(C.parseRecord(C.formatRecord(r, d) + '\n', d), r, 'roundtrip ' + JSON.stringify(r) + d);
}

eq(C.detectDelimiter('a,b,c\n1,2,3\n'), ',');
eq(C.detectDelimiter('a;b;c\n1;2;3\n4;5;6\n'), ';');
eq(C.detectDelimiter('a\tb\tc\n1\t2\t3\n'), '\t');
eq(C.detectDelimiter('a|b|c\n1|2|3\n'), '|');
eq(C.detectDelimiter('"a,b";c;d\n"1,2";3;4\n'), ';');
eq(C.detectDelimiter('single\nvalue\n'), ',');

eq(C.splitRecords('a,b\n"x\ny",z\nlast').length, 3);
eq(C.utf8len('abc'), 3); eq(C.utf8len('é'), 2); eq(C.utf8len('€'), 3); eq(C.utf8len('😀'), 4);
console.log('csv.js: all tests passed');
