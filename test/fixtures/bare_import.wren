// Bare import (without `for` clause) should not produce
// "undefined variable" errors for PascalCase names, since
// the imported module may define them.

import "some_module"

// These use classes potentially from the bare import.
// The analyzer can't resolve them, but should not flag them.
var x = Helper.new()
System.print(x)
