class Foo {
  construct new() {
    _val = 0
  }

  val=(v: Num) { _val = v }
  val { _val }
}

var foo = Foo.new()
foo.val = 42
System.print(foo.val) // expect: 42
