// Import from middleware (which itself imports base_module).
// The analyzer should resolve App from middleware.
import "middleware" for App

var app = App.new()
app.run()
System.print(app.logger)
