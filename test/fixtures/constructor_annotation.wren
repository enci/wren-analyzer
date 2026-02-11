class Foo {
  construct new(name: String, age: Num) {
    _name = name
    _age = age
  }

  toString { _name + " is " + _age.toString }
}

System.print(Foo.new("Alice", 30)) // expect: Alice is 30
