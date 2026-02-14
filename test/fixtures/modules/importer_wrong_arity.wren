// Cross-module arity checking.
// Each line marked "expect warning" should produce a wrong-arity warning.
import "entity" for Entity

var e = Entity.new("hero")

// Correct calls (no warnings)
e.reset()
e.moveTo(5)
e.moveBy(1, 2)
e.init(0, 0, 100)
System.print(e.name)
System.print(e.x)

// Wrong arities — too many args
e.reset(1)          // expect warning
e.moveTo(1, 2)     // expect warning

// Wrong arities — too few args
e.moveBy(1)         // expect warning
e.init(0, 0)        // expect warning

// Static wrong arity
Entity.create()           // expect warning
Entity.create("a", "b")  // expect warning

// Getter called as method
e.name()            // expect warning
e.health()          // expect warning

// Method called as getter
e.reset             // expect warning
e.moveTo            // expect warning
