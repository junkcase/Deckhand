# Deckhand tests

```
cd tests
npm install
npx playwright install chromium
node run.js            # everything (about 10 minutes)
node run.js --quick    # skips the slow text-reader tests
node run.js sync deck  # only files whose names contain "sync" or "deck"
```

- `unit/` run the app in a simulated browser (jsdom): collection, sync, decks, scanning logic, imports.
- `*.test.js` here run the app in real Chromium with simulated Scryfall/EDHREC/GitHub responses.
- `scanner-benchmark.js` and `speed-benchmark.js` are measurements, not pass/fail tests.

GitHub runs `node run.js` on every push (see `.github/workflows/tests.yml`).
