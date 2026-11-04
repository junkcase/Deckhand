// Run the browser tests in WebKit (Safari's engine) instead of Chromium: node --require ./webkit-shim.js <test>
// Chromium-only launch flags are dropped; tests that use Chrome-only tools (CPU throttling) report those as failures.
const pw = require("playwright");
const launch = pw.webkit.launch.bind(pw.webkit);
pw.webkit.launch = (opts = {}) => launch(Object.assign({}, opts, { args: undefined }));
pw.chromium = pw.webkit;
