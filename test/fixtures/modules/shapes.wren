// A module defining shape classes.
class Shape {
  area { 0 }
  perimeter { 0 }
  describe() {
    return "I am a shape"
  }
}

class Circle is Shape {
  construct new(radius) {
    _radius = radius
  }

  radius { _radius }

  area {
    return Num.pi * _radius * _radius
  }

  perimeter {
    return 2 * Num.pi * _radius
  }
}

class Rectangle is Shape {
  construct new(width, height) {
    _width = width
    _height = height
  }

  width { _width }
  height { _height }

  area {
    return _width * _height
  }

  perimeter {
    return 2 * (_width + _height)
  }
}
