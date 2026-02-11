class Vec {
  construct new(x) { _x = x }
  +(other: Vec) { Vec.new(_x + other.x) }
  -(other: Vec) { Vec.new(_x - other.x) }
  x { _x }
  toString { _x.toString }
}

System.print(Vec.new(3) + Vec.new(4)) // expect: 7
System.print(Vec.new(10) - Vec.new(3)) // expect: 7
