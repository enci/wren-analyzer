// =============================================================================
// Wren core and optional module API stubs.
//
// These are Wren source strings declaring every method on every core class.
// They are parsed by the analyzer's own lexer/parser to build the core class
// registry used for type-checking.  All methods use `foreign` declarations —
// we only need signatures (name + arity + types), not implementations.
//
// Type annotations use the analyzer's existing syntax:
//   Parameter types:  foreign foo(x: Num, y: String)
//   Return types:     foreign bar -> Bool
//   Both:             foreign clamp(min: Num, max: Num) -> Num
//
// Methods whose return type is truly dynamic (Fn.call, Fiber.call, etc.)
// are left without return type annotations.
//
// Note: `Null` and `Class` are Wren keywords so they cannot be used as class
// names in stub source. Their methods (toString, !) are inherited from Object
// and are covered by the Object class definition.
//
// Note: Method order is `foreign static`, not `static foreign`, matching
// the parser's expected token order (foreign keyword first, then static).
//
// Sources:
//   Core: wren/src/vm/wren_core.wren  +  wren/src/vm/wren_core.c (PRIMITIVE macros)
//   Random: wren/src/optional/wren_opt_random.wren
//   Meta: wren/src/optional/wren_opt_meta.wren
// =============================================================================

/**
 * Core module — always available in every Wren program.
 *
 * Combines the Wren-defined methods from wren_core.wren with the
 * C primitives registered in wren_core.c via PRIMITIVE() macros.
 */
export const CORE_MODULE_SOURCE = `
// ---------------------------------------------------------------------------
// Object  (root of the class hierarchy)
// ---------------------------------------------------------------------------
class Object {
  // C primitives (wren_core.c)
  foreign ! -> Bool
  foreign ==(other) -> Bool
  foreign !=(other) -> Bool
  foreign is(type) -> Bool
  foreign toString -> String
  foreign type

  // Static
  foreign static same(a, b) -> Bool
}

// ---------------------------------------------------------------------------
// Bool
// ---------------------------------------------------------------------------
class Bool {
  foreign toString -> String
  foreign ! -> Bool
}

// ---------------------------------------------------------------------------
// Fiber
// ---------------------------------------------------------------------------
class Fiber {
  // Instance methods (wren_core.c)
  // call/transfer/try return whatever the fiber yields — type is dynamic.
  foreign call()
  foreign call(value)
  foreign error
  foreign isDone -> Bool
  foreign transfer()
  foreign transfer(value)
  foreign transferError(error)
  foreign try()
  foreign try(value)

  // Static methods (wren_core.c — registered on metaclass)
  foreign static new(fn: Fn) -> Fiber
  foreign static abort(message)
  foreign static current -> Fiber
  foreign static suspend()
  foreign static yield()
  foreign static yield(value)
}

// ---------------------------------------------------------------------------
// Fn
// ---------------------------------------------------------------------------
class Fn {
  foreign arity -> Num
  // call() returns whatever the function returns — type is dynamic.
  foreign call()
  foreign call(a1)
  foreign call(a1, a2)
  foreign call(a1, a2, a3)
  foreign call(a1, a2, a3, a4)
  foreign call(a1, a2, a3, a4, a5)
  foreign call(a1, a2, a3, a4, a5, a6)
  foreign call(a1, a2, a3, a4, a5, a6, a7)
  foreign call(a1, a2, a3, a4, a5, a6, a7, a8)
  foreign call(a1, a2, a3, a4, a5, a6, a7, a8, a9)
  foreign call(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
  foreign call(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11)
  foreign call(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12)
  foreign call(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13)
  foreign call(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14)
  foreign call(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15)
  foreign call(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16)
  foreign toString -> String

  foreign static new(fn) -> Fn
}

// ---------------------------------------------------------------------------
// Num
// ---------------------------------------------------------------------------
class Num {
  // Arithmetic operators
  foreign -(other: Num) -> Num
  foreign +(other: Num) -> Num
  foreign *(other: Num) -> Num
  foreign /(other: Num) -> Num
  foreign %(other: Num) -> Num

  // Comparison operators
  foreign <(other: Num) -> Bool
  foreign >(other: Num) -> Bool
  foreign <=(other: Num) -> Bool
  foreign >=(other: Num) -> Bool
  foreign ==(other) -> Bool
  foreign !=(other) -> Bool

  // Bitwise operators
  foreign &(other: Num) -> Num
  foreign |(other: Num) -> Num
  foreign ^(other: Num) -> Num
  foreign <<(other: Num) -> Num
  foreign >>(other: Num) -> Num

  // Range operators
  foreign ..(other: Num) -> Range
  foreign ...(other: Num) -> Range

  // Unary operators
  foreign ~ -> Num
  foreign - -> Num

  // Math getters
  foreign abs -> Num
  foreign acos -> Num
  foreign asin -> Num
  foreign atan -> Num
  foreign cbrt -> Num
  foreign ceil -> Num
  foreign cos -> Num
  foreign floor -> Num
  foreign round -> Num
  foreign sin -> Num
  foreign sqrt -> Num
  foreign tan -> Num
  foreign log -> Num
  foreign log2 -> Num
  foreign exp -> Num
  foreign fraction -> Num
  foreign sign -> Num
  foreign truncate -> Num

  // Boolean getters
  foreign isInfinity -> Bool
  foreign isInteger -> Bool
  foreign isNan -> Bool

  foreign toString -> String

  // Methods with arguments
  foreign atan(other: Num) -> Num
  foreign pow(exponent: Num) -> Num
  foreign min(other: Num) -> Num
  foreign max(other: Num) -> Num
  foreign clamp(min: Num, max: Num) -> Num

  // Static getters
  foreign static fromString(value: String) -> Num
  foreign static infinity -> Num
  foreign static nan -> Num
  foreign static pi -> Num
  foreign static tau -> Num
  foreign static largest -> Num
  foreign static smallest -> Num
  foreign static maxSafeInteger -> Num
  foreign static minSafeInteger -> Num
}

// ---------------------------------------------------------------------------
// Sequence  (base class for iterable collections)
// ---------------------------------------------------------------------------
class Sequence {
  foreign all(f: Fn) -> Bool
  foreign any(f: Fn) -> Bool
  foreign contains(element) -> Bool
  foreign count -> Num
  foreign count(f: Fn) -> Num
  foreign each(f: Fn)
  foreign isEmpty -> Bool
  foreign map(transformation: Fn) -> Sequence
  foreign skip(count: Num) -> Sequence
  foreign take(count: Num) -> Sequence
  foreign where(predicate: Fn) -> Sequence
  foreign reduce(acc, f: Fn)
  foreign reduce(f: Fn)
  foreign join() -> String
  foreign join(sep: String) -> String
  foreign toList -> List
  foreign toString -> String
}

// ---------------------------------------------------------------------------
// String  (is Sequence)
// ---------------------------------------------------------------------------
class String is Sequence {
  foreign +(other) -> String
  foreign [index] -> String
  foreign byteAt(index: Num) -> Num
  foreign byteCount -> Num
  foreign codePointAt(index: Num) -> Num
  foreign contains(search: String) -> Bool
  foreign endsWith(suffix: String) -> Bool
  foreign indexOf(search: String) -> Num
  foreign indexOf(search: String, start: Num) -> Num
  foreign iterate(iterator)
  foreign iteratorValue(iterator) -> String
  foreign startsWith(prefix: String) -> Bool
  foreign toString -> String

  foreign bytes -> Sequence
  foreign codePoints -> Sequence
  foreign split(delimiter: String) -> List
  foreign replace(from: String, to: String) -> String
  foreign trim() -> String
  foreign trim(chars: String) -> String
  foreign trimEnd() -> String
  foreign trimEnd(chars: String) -> String
  foreign trimStart() -> String
  foreign trimStart(chars: String) -> String
  foreign *(count: Num) -> String

  foreign static fromCodePoint(codePoint: Num) -> String
  foreign static fromByte(byte: Num) -> String
}

// ---------------------------------------------------------------------------
// List  (is Sequence)
// ---------------------------------------------------------------------------
class List is Sequence {
  foreign [index]
  foreign [index]=(value)
  foreign add(item) -> List
  foreign clear()
  foreign count -> Num
  foreign insert(index: Num, item) -> List
  foreign iterate(iterator)
  foreign iteratorValue(iterator)
  foreign removeAt(index: Num)
  foreign remove(value)
  foreign indexOf(value) -> Num
  foreign swap(index0: Num, index1: Num)

  foreign addAll(other) -> List
  foreign sort() -> List
  foreign sort(comparer: Fn) -> List
  foreign toString -> String
  foreign +(other) -> List
  foreign *(count: Num) -> List

  foreign static new() -> List
  foreign static filled(size: Num, element) -> List
}

// ---------------------------------------------------------------------------
// Map  (is Sequence)
// ---------------------------------------------------------------------------
class Map is Sequence {
  foreign [key]
  foreign [key]=(value)
  foreign clear()
  foreign containsKey(key) -> Bool
  foreign count -> Num
  foreign remove(key)
  foreign iterate(iterator)

  foreign keys -> List
  foreign values -> List
  foreign toString -> String
  foreign iteratorValue(iterator)

  foreign static new() -> Map
}

// ---------------------------------------------------------------------------
// MapEntry
// ---------------------------------------------------------------------------
class MapEntry {
  construct new(key, value) {}
  foreign key
  foreign value
  foreign toString -> String
}

// ---------------------------------------------------------------------------
// Range  (is Sequence)
// ---------------------------------------------------------------------------
class Range is Sequence {
  foreign from -> Num
  foreign to -> Num
  foreign min -> Num
  foreign max -> Num
  foreign isInclusive -> Bool
  foreign iterate(iterator)
  foreign iteratorValue(iterator) -> Num
  foreign toString -> String
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------
class System {
  foreign static clock -> Num
  foreign static gc()
  foreign static print()
  foreign static print(object)
  foreign static printAll(sequence)
  foreign static write(object)
  foreign static writeAll(sequence)
}
`;

/**
 * Random module — available via `import "random"`.
 * Source: wren/src/optional/wren_opt_random.wren
 */
export const RANDOM_MODULE_SOURCE = `
foreign class Random {
  construct new() {}
  construct new(seed: Num) {}

  foreign float() -> Num
  foreign float(end: Num) -> Num
  foreign float(start: Num, end: Num) -> Num
  foreign int() -> Num
  foreign int(end: Num) -> Num
  foreign int(start: Num, end: Num) -> Num
  foreign sample(list: List)
  foreign sample(list: List, count: Num) -> List
  foreign shuffle(list: List)
}
`;

/**
 * Meta module — available via `import "meta"`.
 * Source: wren/src/optional/wren_opt_meta.wren
 */
export const META_MODULE_SOURCE = `
class Meta {
  foreign static getModuleVariables(module: String) -> List
  foreign static eval(source: String)
  foreign static compileExpression(source: String) -> Fn
  foreign static compile(source: String) -> Fn
}
`;
