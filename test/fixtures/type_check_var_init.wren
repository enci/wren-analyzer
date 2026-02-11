// Correct types produce no warnings and run normally.
var x: Num = 42
System.print(x) // expect: 42

var s: String = "hello"
System.print(s) // expect: hello

var b: Bool = true
System.print(b) // expect: true

var n: Null = null
System.print(n) // expect: null

var l: List = [1, 2, 3]
System.print(l) // expect: [1, 2, 3]

var m: Map = {"a": 1}
System.print(m) // expect: {a: 1}

// Mismatched types produce warnings but still run.
var bad: Num = "oops" // expect warning
System.print(bad) // expect: oops

var bad2: String = 42 // expect warning
System.print(bad2) // expect: 42
