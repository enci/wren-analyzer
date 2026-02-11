// Variables and methods without type annotations produce no warnings.
// This ensures the type checker is non-strict: no annotation = no checking.
{
  var x = 42
  System.print(x) // expect: 42

  x = "now a string"
  System.print(x) // expect: now a string

  x = true
  System.print(x) // expect: true
}

class Foo {
  static compute() {
    return "hello"
  }

  static add(a, b) {
    return a + b
  }
}

System.print(Foo.compute()) // expect: hello
System.print(Foo.add(1, 2)) // expect: 3
