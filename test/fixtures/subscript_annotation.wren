class Grid {
  construct new() {
    _data = [1, 2, 3, 4]
  }

  [index: Num] { _data[index] }
}

var g = Grid.new()
System.print(g[0]) // expect: 1
System.print(g[2]) // expect: 3
