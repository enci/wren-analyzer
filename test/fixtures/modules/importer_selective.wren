// Selective import: only bring in specific names.
import "helper" for Helper

var h = Helper.new("World")
System.print(h.greet())
System.print(h.name)
