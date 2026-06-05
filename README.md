# shubhmall.com

A deliberately small personal site. Two pages, no framework, no backend.

- **`index.html`**: who I am, in a few sentences.
- **`chess.html`**: a chess bot that opens with my real chess.com repertoire
  (built from 8,000+ of my games), then hands off to Stockfish. Runs entirely
  in the browser.

## Stack

Pure static HTML/CSS/JS. [chess.js](https://github.com/jhlywa/chess.js) for the
rules, [Stockfish](https://stockfishchess.org/) (asm.js, single-threaded, no
special headers, so it works on GitHub Pages) for the engine.

```
index.html          landing
chess.html          play the bot
assets/             style.css, chess-game.js, favicon.svg
vendor/             chess.mjs, stockfish.js
book.json           opening book, generated from my games
build_book.py       regenerate book.json from chess.com
serve.py            local dev server with correct JS MIME types
```

## Run locally

```bash
python serve.py        # http://localhost:4321  (plain http.server serves .js as text/plain, so don't use it)
```

## Rebuild the opening book

```bash
pip install python-chess
python build_book.py   # refetches my chess.com archive -> book.json
```

## Deploy

Push to `main`. The workflow in `.github/workflows/pages.yml` publishes the
repo root to GitHub Pages. Enable it once under **Settings → Pages → Source:
GitHub Actions**.
