// Test type checking for module-level (top-level) variables.

// Correct init: no warning.
var x: Num = 42
System.print(x) // expect: 42

var s: String = "hello"
System.print(s) // expect: hello

// Mismatched init: warning but still runs.
var bad: Num = "oops" // expect warning
System.print(bad) // expect: oops

// Correct reassignment: no warning.
x = 100
System.print(x) // expect: 100

// Mismatched reassignment: warning but still runs.
x = "not a number" // expect warning
System.print(x) // expect: not a number

s = true // expect warning
System.print(s) // expect: true

// Back to correct type: no warning.
x = 7
System.print(x) // expect: 7

// Unannotated module variable: no checking.
var any = 42
any = "fine"
System.print(any) // expect: fine
