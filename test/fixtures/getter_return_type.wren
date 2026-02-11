class Foo {
  construct new(val) {
    _val = val
  }

  val -> Num { _val }
}

var foo = Foo.new(42)
System.print(foo.val) // expect: 42
