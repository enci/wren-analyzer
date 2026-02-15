// =============================================================================
// Wren core and optional module API stubs.
//
// These are Wren source strings declaring every method on every core class.
// They are parsed by the analyzer's own lexer/parser to build the core class
// registry used for type-checking.  All methods use `foreign` declarations —
// we only need signatures (name + arity), not implementations.
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
  foreign !
  foreign ==(other)
  foreign !=(other)
  foreign is(type)
  foreign toString
  foreign type

  // Static
  foreign static same(a, b)
}

// ---------------------------------------------------------------------------
// Bool
// ---------------------------------------------------------------------------
class Bool {
  foreign toString
  foreign !
}

// ---------------------------------------------------------------------------
// Fiber
// ---------------------------------------------------------------------------
class Fiber {
  // Instance methods (wren_core.c)
  foreign call()
  foreign call(value)
  foreign error
  foreign isDone
  foreign transfer()
  foreign transfer(value)
  foreign transferError(error)
  foreign try()
  foreign try(value)

  // Static methods (wren_core.c — registered on metaclass)
  foreign static new(fn)
  foreign static abort(message)
  foreign static current
  foreign static suspend()
  foreign static yield()
  foreign static yield(value)
}

// ---------------------------------------------------------------------------
// Fn
// ---------------------------------------------------------------------------
class Fn {
  foreign arity
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
  foreign toString

  foreign static new(fn)
}

// ---------------------------------------------------------------------------
// Num
// ---------------------------------------------------------------------------
class Num {
  // Operators (wren_core.c)
  foreign -(other)
  foreign +(other)
  foreign *(other)
  foreign /(other)
  foreign <(other)
  foreign >(other)
  foreign <=(other)
  foreign >=(other)
  foreign &(other)
  foreign |(other)
  foreign ^(other)
  foreign <<(other)
  foreign >>(other)
  foreign %(other)
  foreign ==(other)
  foreign !=(other)
  foreign ..(other)
  foreign ...(other)
  foreign ~

  // Unary minus (prefix operator)
  foreign -

  // Getters (wren_core.c)
  foreign abs
  foreign acos
  foreign asin
  foreign atan
  foreign cbrt
  foreign ceil
  foreign cos
  foreign floor
  foreign round
  foreign sin
  foreign sqrt
  foreign tan
  foreign log
  foreign log2
  foreign exp
  foreign fraction
  foreign isInfinity
  foreign isInteger
  foreign isNan
  foreign sign
  foreign toString
  foreign truncate

  // Methods with arguments (wren_core.c)
  foreign atan(other)
  foreign pow(exponent)
  foreign min(other)
  foreign max(other)
  foreign clamp(min, max)

  // Static getters (wren_core.c — registered on metaclass)
  foreign static fromString(value)
  foreign static infinity
  foreign static nan
  foreign static pi
  foreign static tau
  foreign static largest
  foreign static smallest
  foreign static maxSafeInteger
  foreign static minSafeInteger
}

// ---------------------------------------------------------------------------
// Sequence  (base class for iterable collections)
// ---------------------------------------------------------------------------
class Sequence {
  // Wren-defined methods (wren_core.wren)
  foreign all(f)
  foreign any(f)
  foreign contains(element)
  foreign count
  foreign count(f)
  foreign each(f)
  foreign isEmpty
  foreign map(transformation)
  foreign skip(count)
  foreign take(count)
  foreign where(predicate)
  foreign reduce(acc, f)
  foreign reduce(f)
  foreign join()
  foreign join(sep)
  foreign toList
  foreign toString
}

// ---------------------------------------------------------------------------
// String  (is Sequence)
// ---------------------------------------------------------------------------
class String is Sequence {
  // C primitives (wren_core.c)
  foreign +(other)
  foreign [index]
  foreign byteAt(index)
  foreign byteCount
  foreign codePointAt(index)
  foreign contains(search)
  foreign endsWith(suffix)
  foreign indexOf(search)
  foreign indexOf(search, start)
  foreign iterate(iterator)
  foreign iteratorValue(iterator)
  foreign startsWith(prefix)
  foreign toString

  // Wren-defined methods (wren_core.wren)
  foreign bytes
  foreign codePoints
  foreign split(delimiter)
  foreign replace(from, to)
  foreign trim()
  foreign trim(chars)
  foreign trimEnd()
  foreign trimEnd(chars)
  foreign trimStart()
  foreign trimStart(chars)
  foreign *(count)

  // Static methods (wren_core.c — registered on metaclass)
  foreign static fromCodePoint(codePoint)
  foreign static fromByte(byte)
}

// ---------------------------------------------------------------------------
// List  (is Sequence)
// ---------------------------------------------------------------------------
class List is Sequence {
  // C primitives (wren_core.c)
  foreign [index]
  foreign [index]=(value)
  foreign add(item)
  foreign clear()
  foreign count
  foreign insert(index, item)
  foreign iterate(iterator)
  foreign iteratorValue(iterator)
  foreign removeAt(index)
  foreign remove(value)
  foreign indexOf(value)
  foreign swap(index0, index1)

  // Wren-defined methods (wren_core.wren)
  foreign addAll(other)
  foreign sort()
  foreign sort(comparer)
  foreign toString
  foreign +(other)
  foreign *(count)

  // Static methods (wren_core.c — registered on metaclass)
  foreign static new()
  foreign static filled(size, element)
}

// ---------------------------------------------------------------------------
// Map  (is Sequence)
// ---------------------------------------------------------------------------
class Map is Sequence {
  // C primitives (wren_core.c)
  foreign [key]
  foreign [key]=(value)
  foreign clear()
  foreign containsKey(key)
  foreign count
  foreign remove(key)
  foreign iterate(iterator)

  // Wren-defined methods (wren_core.wren)
  foreign keys
  foreign values
  foreign toString
  foreign iteratorValue(iterator)

  // Static methods (wren_core.c — registered on metaclass)
  foreign static new()
}

// ---------------------------------------------------------------------------
// MapEntry
// ---------------------------------------------------------------------------
class MapEntry {
  construct new(key, value) {}
  foreign key
  foreign value
  foreign toString
}

// ---------------------------------------------------------------------------
// Range  (is Sequence)
// ---------------------------------------------------------------------------
class Range is Sequence {
  // C primitives (wren_core.c)
  foreign from
  foreign to
  foreign min
  foreign max
  foreign isInclusive
  foreign iterate(iterator)
  foreign iteratorValue(iterator)
  foreign toString
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------
class System {
  // Static only (wren_core.c + wren_core.wren)
  foreign static clock
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
  construct new(seed) {}

  foreign float()
  foreign float(end)
  foreign float(start, end)
  foreign int()
  foreign int(end)
  foreign int(start, end)
  foreign sample(list)
  foreign sample(list, count)
  foreign shuffle(list)
}
`;

/**
 * Meta module — available via `import "meta"`.
 * Source: wren/src/optional/wren_opt_meta.wren
 */
export const META_MODULE_SOURCE = `
class Meta {
  foreign static getModuleVariables(module)
  foreign static eval(source)
  foreign static compileExpression(source)
  foreign static compile(source)
}
`;
