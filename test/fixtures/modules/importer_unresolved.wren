// Import from a module that doesn't exist.
// The class name should still not cause "undefined variable" errors
// because the import statement registers the variable name.
import "nonexistent_module" for SomeClass

var x = SomeClass.new()
System.print(x)
