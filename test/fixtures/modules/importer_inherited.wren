// Import shapes and test that inherited methods work cross-module.
import "shapes" for Circle, Shape

var c = Circle.new(10)

// Methods defined on Circle
System.print(c.radius)
System.print(c.area)

// Inherited from Shape
System.print(c.describe())
