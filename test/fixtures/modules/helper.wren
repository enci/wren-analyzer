// A helper module that defines a class with methods.
class Helper {
  construct new(name) {
    _name = name
  }

  name { _name }

  greet() {
    return "Hello, %(_name)!"
  }

  static create(name) {
    return Helper.new(name)
  }
}

class MathUtils {
  static square(n) {
    return n * n
  }

  static cube(n) {
    return n * n * n
  }

  static double(n) {
    return n * 2
  }
}

var HELPER_VERSION = "1.0"
