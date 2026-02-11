class Point {
  construct new(x: Num, y: Num) {
    _x = x
    _y = y
  }

  x -> Num { _x }
  y -> Num { _y }
  toString { "(%(_x), %(_y))" }

  +(other: Point) -> Point {
    return Point.new(_x + other.x, _y + other.y)
  }
}

var p1: Point = Point.new(1, 2)
var p2: Point = Point.new(3, 4)
var p3: Point = p1 + p2

System.print(p1) // expect: (1, 2)
System.print(p2) // expect: (3, 4)
System.print(p3) // expect: (4, 6)
