var fn = Fn.new {|x: Num|
  return x * 2
}
System.print(fn.call(21)) // expect: 42
