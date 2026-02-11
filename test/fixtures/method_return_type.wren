class Foo {
  construct new() {}

  greet(name: String) -> String {
    return "Hello, " + name
  }

  add(a: Num, b: Num) -> Num {
    return a + b
  }
}

var foo = Foo.new()
System.print(foo.greet("World")) // expect: Hello, World
System.print(foo.add(1, 2)) // expect: 3
