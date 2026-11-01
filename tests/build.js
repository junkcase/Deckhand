// Prepares the app for testing: the script on its own (for the jsdom tests) and two test pages
// (app.html: local text reader + simulated Scryfall card list; app_real.html: network calls left to each test).
const fs = require("fs"), path = require("path");
const idx = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
fs.mkdirSync(path.join(__dirname, ".build"), { recursive: true });
fs.writeFileSync(path.join(__dirname, ".build", "app.js"), idx.match(/<script>([\s\S]*?)<\/script>/)[1]);
const TESS = '<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"></script>';
if (!idx.includes(TESS)) throw new Error("The text reader script tag changed; update tests/build.js");
const app = idx.replace(TESS, fs.readFileSync(path.join(__dirname, "boot.html"), "utf8"));
fs.writeFileSync(path.join(__dirname, "app.html"), app);
fs.writeFileSync(path.join(__dirname, "app_real.html"), app.replace('<script src="names.js"></script>', "").replace('if (u.includes("api.scryfall.com")) {', "if (false) {"));
console.log("built .build/app.js, app.html, app_real.html");
