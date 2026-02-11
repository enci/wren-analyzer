// Regression: existing syntax without type annotations still works.
var x = 42
System.print(x) // expect: 42

var s = "hello"
System.print(s) // expect: hello

{
  var n
  System.print(n) // expect: null
}
