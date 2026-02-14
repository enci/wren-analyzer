// A module with getters, setters, and methods at various arities.
class Entity {
  construct new(name) {
    _name = name
    _x = 0
    _y = 0
    _health = 100
  }

  // Getters (arity -1)
  name { _name }
  x { _x }
  y { _y }
  health { _health }

  // Setters
  name=(value) { _name = value }
  x=(value) { _x = value }
  y=(value) { _y = value }

  // Zero-arg method
  reset() {
    _x = 0
    _y = 0
  }

  // One-arg method
  moveTo(pos) {
    _x = pos
    _y = pos
  }

  // Two-arg method
  moveBy(dx, dy) {
    _x = _x + dx
    _y = _y + dy
  }

  // Three-arg method
  init(x, y, health) {
    _x = x
    _y = y
    _health = health
  }

  // Static getter
  static defaultName { "unnamed" }

  // Static zero-arg method
  static count() { 0 }

  // Static one-arg method
  static create(name) {
    return Entity.new(name)
  }
}

class Spawner {
  construct new() {
    _entities = []
  }

  entities { _entities }

  spawn(name) {
    var e = Entity.new(name)
    _entities.add(e)
    return e
  }

  spawnAt(name, x, y) {
    var e = Entity.new(name)
    e.x = x
    e.y = y
    _entities.add(e)
    return e
  }
}
