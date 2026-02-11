// Test type checking on variable reassignment (local scope).
{
  var x: Num = 42
  System.print(x) // expect: 42

  // Correct reassignment: no warning.
  x = 100
  System.print(x) // expect: 100

  // Mismatched reassignment: warning but still runs.
  x = "oops" // expect warning
  System.print(x) // expect: oops

  x = true // expect warning
  System.print(x) // expect: true

  // Back to correct type: no warning.
  x = 7
  System.print(x) // expect: 7
}
