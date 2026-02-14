// Cross-module getter vs method distinction.
// Wren treats `foo`, `foo()`, and `foo(_)` as distinct signatures.
import "entity" for Entity, Spawner

var e = Entity.new("hero")
var s = Spawner.new()

// === Correct usage (no warnings) ===

// Getters accessed correctly
System.print(e.name)
System.print(e.x)
System.print(e.y)
System.print(e.health)
System.print(s.entities)

// Methods called correctly
e.reset()
e.moveTo(5)
e.moveBy(1, 2)
e.init(0, 0, 100)
s.spawn("goblin")
s.spawnAt("goblin", 3, 4)

// Static getter accessed correctly
System.print(Entity.defaultName)

// Static method called correctly
Entity.count()
Entity.create("npc")

// Setter used correctly
e.name = "villain"
e.x = 10
e.y = 20

// === Incorrect usage (expect warnings) ===

// Getter called as zero-arg method
e.name()            // expect warning
e.health()          // expect warning
Entity.defaultName()  // expect warning

// Zero-arg method used as getter
e.reset             // expect warning
Entity.count        // expect warning

// One-arg method used as getter
e.moveTo            // expect warning

// One-arg method called with wrong arg count
e.moveTo(1, 2)     // expect warning

// Two-arg method called with wrong arg count
e.moveBy(1)         // expect warning
s.spawnAt("a")      // expect warning
