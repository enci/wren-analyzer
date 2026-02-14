// Bare import: all top-level names from the module are available.
import "helper"

var h = Helper.new("World")
System.print(h.greet())
System.print(h.name)

// MathUtils is also available via bare import
var sq = MathUtils.square(5)
System.print(sq)
