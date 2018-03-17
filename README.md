# Rena.js
Rena.js is a library of parsing texts. Rena.js makes parsing text easily.  
Rena.js can treat recursion of pattern, hence Rena.js can parse languages which described top down parsing
like arithmetic expressions and so on.  
Rena.js can also treat synthesized and inherited attributes.  
'Rena' is an acronym of REpetation (or REcursion) Notation API.  

## Examples

### Parsing CSV texts
```js
var csvparser = R.t(
  R.attr([]).maybe(
    R.delimitArray(
      R.delimitArray(R.or(
        R('"').t(/(""|[^"])+/, function(x) { return x.replace('""', '"'); }).t('"'),
        R(/[^",\n\r]+/, R.I)), ","), R.br())))
  .maybe(R.br())
  .isEnd();

// outputs [["a","b","c"],["d","e\n\"f","g"],["h"]]
console.log(csvparser.parse('a,b,c\nd,"e\n""f",g\nh\n').attribute)
```

### Parsing simple arithmetic expressions
```js
var expr = R.Yn(function(t, f, e) {
  return R.t(f).maybe(R.or(
    R.t("+").t(f, function(x, a, b) { return b + a; }),
    R.t("-").t(f, function(x, a, b) { return b - a; })));
  },
function(t, f, e) {
  return R.t(e).maybe(R.or(
    R.t("*").t(e, function(x, a, b) { return b * a; }),
    R.t("/").t(e, function(x, a, b) { return b / a; })));
},
function(t, f, e) {
  return R.or(R.thenInt(/[0-9]+/), R.t("(").t(t).t(")"))
}).isEnd();

// outputs 7
console.log(expr.parse("1+2*3").attribute);

// outputs 1
console.log(ptn1.parse("4-6/2").attribute);
```

## Document
[A document of Rena.js is here.](http://rena.morilib.net/-_anonymous_-RenaFactory-Rena.html)
