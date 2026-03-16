// A typed variable with no initializer gets null, which is valid for any type.
{
  var n: Num
  System.print(n) // expect: null

  // Assigning the correct type afterward is fine.
  n = 42
  System.print(n) // expect: 42
}
