// A typed variable with no initializer gets null, which may not match.
{
  var n: Num // expect warning
  System.print(n) // expect: null

  // Assigning the correct type afterward is fine.
  n = 42
  System.print(n) // expect: 42
}
