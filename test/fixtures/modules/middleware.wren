// Middleware module that imports from base_module and re-exports.
import "base_module" for BaseLogger

class App {
  construct new() {
    _logger = BaseLogger.new()
  }

  logger { _logger }

  run() {
    _logger.log("App is running")
  }

  static create() {
    return App.new()
  }
}
