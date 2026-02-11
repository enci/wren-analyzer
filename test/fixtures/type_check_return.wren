// Test type checking on return statements.
class Foo {
  // Correct return type: no warning.
  static goodNum() -> Num {
    return 42
  }

  static goodString() -> String {
    return "hello"
  }

  // Mismatched return type: warning but still runs.
  static badReturn() -> Num {
    return "oops" // expect warning
  }

  // Bare return in typed method: returns null, warns.
  static bareReturn() -> Num {
    return // expect warning
  }

  // No return annotation: no checking.
  static noAnnotation() {
    return "anything"
  }
}

System.print(Foo.goodNum()) // expect: 42
System.print(Foo.goodString()) // expect: hello
System.print(Foo.badReturn()) // expect: oops
System.print(Foo.bareReturn()) // expect: null
System.print(Foo.noAnnotation()) // expect: anything
