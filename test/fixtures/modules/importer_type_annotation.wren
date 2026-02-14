// Cross-module type annotations and type inference.
// Variables typed with imported class names should be checked.
import "entity" for Entity
import "shapes" for Circle, Rectangle

// Type inferred from constructor call
var e = Entity.new("hero")
e.reset()          // valid
e.moveBy(1, 2)     // valid
System.print(e.name) // valid

// Inferred Circle type from constructor
var c = Circle.new(5)
System.print(c.radius) // valid
System.print(c.area)   // valid

// Inferred Rectangle type from constructor
var r = Rectangle.new(3, 4)
System.print(r.width)   // valid
System.print(r.height)  // valid
System.print(r.area)    // valid

// Cross-module constructor with wrong method
e.nonExistent()    // expect warning
c.nonExistent()    // expect warning
r.nonExistent()    // expect warning
