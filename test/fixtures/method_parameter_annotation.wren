class Foo {
  construct new() {}

  add(a: Num, b: Num) {
    return a + b
  }

  greet(name: String) {
    return "hi " + name
  }
}

var foo = Foo.new()
System.print(foo.add(1, 2)) // expect: 3
System.print(foo.greet("world")) // expect: hi world
