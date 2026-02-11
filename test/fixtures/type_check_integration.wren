// Integration test: combines init, assignment, and return type checking.
class Calculator {
  static add(a: Num, b: Num) -> Num {
    return a + b
  }

  static greet(name: String) -> String {
    return "Hi, %(name)!"
  }

  static badReturn() -> Bool {
    return 42 // expect warning
  }
}

// Correct init and usage.
{
  var result: Num = 42
  System.print(result) // expect: 42

  var msg: String = "hello"
  System.print(msg) // expect: hello

  // Correct reassignment.
  result = 99
  System.print(result) // expect: 99

  // Mismatched init.
  var oops: Num = "wrong" // expect warning
  System.print(oops) // expect: wrong

  // Mismatched reassignment.
  result = "not a number" // expect warning
  System.print(result) // expect: not a number
}

// Methods still run despite warnings.
System.print(Calculator.badReturn()) // expect: 42
System.print(Calculator.greet("Wren")) // expect: Hi, Wren!
