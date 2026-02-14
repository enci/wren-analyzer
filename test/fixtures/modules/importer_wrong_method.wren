// Import a class and call a method that doesn't exist on it.
// The type checker should warn about these.
import "helper" for Helper

var h = Helper.new("World")
System.print(h.greet())

// These should produce warnings:
System.print(h.nonExistentMethod()) // expect warning
Helper.unknownStatic() // expect warning
