class Greeter {
  construct new(name: String) {
    _name = name
  }

  greet(greeting: String) -> String {
    return greeting + ", " + _name
  }

  name -> String { _name }
  name=(value: String) { _name = value }
}

var g: Greeter = Greeter.new("World")
System.print(g.greet("Hello")) // expect: Hello, World
System.print(g.name) // expect: World
g.name = "Wren"
System.print(g.name) // expect: Wren

for (i: Num in 1..3) {
  System.print(i)
}
// expect: 1
// expect: 2
// expect: 3

var fn: Fn = Fn.new {|x: Num|
  return x * 2
}
System.print(fn.call(5)) // expect: 10
