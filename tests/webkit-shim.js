// Run the browser tests in WebKit (Safari's engine) instead of Chromium: node --require ./webkit-shim.js <test>
// Chromium-only launch flags are dropped, and permissions WebKit can't grant (clipboard) are skipped.
// Tests that use Chrome-only tools (CPU throttling) still report those parts as failures.
const pw = require("playwright");
const launch = pw.webkit.launch.bind(pw.webkit);
const fixCtx = ctx => { const g = ctx.grantPermissions.bind(ctx); ctx.grantPermissions = async (perms, o) => { try { await g(perms.filter(p => !/^clipboard/.test(p)), o); } catch (e) {} }; return ctx; };
pw.webkit.launch = async (opts = {}) => {
  const b = await launch(Object.assign({}, opts, { args: undefined })), nc = b.newContext.bind(b), np = b.newPage.bind(b);
  b.newContext = async o => fixCtx(await nc(o)); b.newPage = async o => { const p = await np(o); fixCtx(p.context()); return p; };
  return b;
};
pw.chromium = pw.webkit;
