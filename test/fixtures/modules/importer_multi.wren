// Import from multiple modules.
import "helper" for Helper
import "shapes" for Circle, Rectangle

var h = Helper.new("World")
System.print(h.greet())

var c = Circle.new(5)
System.print(c.area)
System.print(c.perimeter)
System.print(c.describe())

var r = Rectangle.new(3, 4)
System.print(r.area)
System.print(r.width)
System.print(r.height)
