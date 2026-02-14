// Cross-module inherited method arity checking.
// Shape defines describe() — Circle inherits it.
// Calling c.describe with wrong arity should warn.
import "shapes" for Circle

var c = Circle.new(5)

// Correct: inherited method called properly
System.print(c.describe())

// Correct: own methods
System.print(c.radius)
System.print(c.area)
System.print(c.perimeter)

// Wrong: inherited method called as getter (describe is a zero-arg method)
c.describe          // expect warning

// Wrong: own getter called as method
c.radius()          // expect warning
c.area()            // expect warning
