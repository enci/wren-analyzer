// A base module that is imported by middleware.
class BaseLogger {
  construct new() {}

  log(message) {
    System.print(message)
  }

  static create() {
    return BaseLogger.new()
  }
}
