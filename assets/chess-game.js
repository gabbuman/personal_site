// Play-Shubh bot. Opening = Shubh's real chess.com repertoire (book.json),
// then Stockfish takes over. Pure client-side, no server. Uses chess.js for rules.
import { Chess } from '../vendor/chess.mjs';

const GLYPH = { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚' };
const FILES = 'abcdefgh';

const game = new Chess();
let book = {};
let humanColor = 'w';        // human is White by default; bot plays Shubh's pieces
let selected = null;         // selected square e.g. 'e2'
let lastMove = null;         // {from,to}
let thinking = false;

const boardEl  = document.getElementById('board');
const statusEl = document.getElementById('status');

// ---------- Stockfish worker (vendored, no special headers needed) ----------
let sf = null, sfResolve = null;
function initStockfish() {
  try {
    sf = new Worker('vendor/stockfish.js');
    sf.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (line.startsWith('bestmove') && sfResolve) {
        const mv = line.split(' ')[1];
        const r = sfResolve; sfResolve = null; r(mv);
      }
    };
    sf.postMessage('uci');
    sf.postMessage('isready');
  } catch (err) { sf = null; }
}
function stockfishMove(fen) {
  return new Promise((resolve) => {
    if (!sf) return resolve(null);
    sfResolve = resolve;
    sf.postMessage('position fen ' + fen);
    sf.postMessage('go movetime 700');
    setTimeout(() => { if (sfResolve) { sfResolve = null; resolve(null); } }, 3000);
  });
}

// ---------- book lookup ----------
const bookKey = (g) => g.fen().split(' ').slice(0, 4).join(' ');

function bookMove(g) {
  const entry = book[bookKey(g)];
  if (!entry || !entry.length) return null;
  const legal = new Set(g.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')));
  // keep only book moves that are legal here, then sample weighted by Shubh's frequency
  const choices = entry.filter(([uci]) => legal.has(uci) || legal.has(uci + 'q'));
  if (!choices.length) return null;
  const total = choices.reduce((s, [, c]) => s + c, 0);
  let r = Math.random() * total;
  for (const [uci, c] of choices) { r -= c; if (r <= 0) return uci; }
  return choices[0][0];
}

// ---------- rendering ----------
function render() {
  const board = game.board();              // 8x8 from rank 8 -> 1
  const flip = humanColor === 'b';
  const legalFrom = selected
    ? game.moves({ square: selected, verbose: true })
    : [];
  const targets = new Map(legalFrom.map(m => [m.to, m]));

  boardEl.innerHTML = '';
  for (let dr = 0; dr < 8; dr++) {
    for (let dc = 0; dc < 8; dc++) {
      const r = flip ? 7 - dr : dr;
      const c = flip ? 7 - dc : dc;
      const sq = FILES[c] + (8 - r);
      const piece = board[r][c];
      const cell = document.createElement('div');
      cell.className = 'sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      cell.dataset.sq = sq;
      if (selected === sq) cell.classList.add('sel');
      if (lastMove && (lastMove.from === sq || lastMove.to === sq)) cell.classList.add('last');
      if (targets.has(sq)) {
        cell.classList.add('move');
        if (targets.get(sq).captured || targets.get(sq).flags.includes('e')) cell.classList.add('cap');
      }
      if (piece) {
        const span = document.createElement('span');
        span.className = 'pc ' + piece.color;
        span.textContent = GLYPH[piece.type];
        cell.appendChild(span);
      }
      cell.addEventListener('click', () => onSquare(sq));
      boardEl.appendChild(cell);
    }
  }
  updateStatus();
}

function updateStatus() {
  if (game.isCheckmate()) {
    const youWon = game.turn() !== humanColor;
    statusEl.innerHTML = youWon ? 'checkmate <b>(you win)</b>' : 'checkmate <b>(Shubh wins)</b>';
  } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    statusEl.innerHTML = '<b>draw</b>';
  } else if (thinking) {
    statusEl.innerHTML = 'Shubh is thinking…';
  } else if (game.turn() === humanColor) {
    statusEl.innerHTML = game.inCheck() ? 'your move <b>(check)</b>' : 'your move';
  } else {
    statusEl.innerHTML = 'Shubh to move';
  }
}

// ---------- interaction ----------
function onSquare(sq) {
  if (thinking || game.isGameOver() || game.turn() !== humanColor) return;
  const piece = game.get(sq);
  if (selected) {
    if (sq === selected) { selected = null; return render(); }
    const move = tryMove(selected, sq);
    if (move) { selected = null; return afterHuman(); }
    // reselect own piece, else clear
    selected = (piece && piece.color === humanColor) ? sq : null;
    return render();
  }
  if (piece && piece.color === humanColor) { selected = sq; render(); }
}

function tryMove(from, to) {
  try {
    const m = game.move({ from, to, promotion: 'q' });
    if (m) lastMove = { from, to };
    return m;
  } catch { return null; }
}

function afterHuman() {
  render();
  if (game.isGameOver()) return;
  thinking = true; updateStatus();
  setTimeout(botMove, 350);
}

async function botMove() {
  let uci = bookMove(game);                 // play like Shubh in the opening
  if (!uci) uci = await stockfishMove(game.fen());   // else Stockfish
  if (!uci) {                               // last-ditch: random legal
    const ms = game.moves({ verbose: true });
    if (ms.length) uci = ms[Math.floor(Math.random() * ms.length)].from + '';
  }
  if (uci) {
    const from = uci.slice(0, 2), to = uci.slice(2, 4), promo = uci.slice(4) || 'q';
    try { game.move({ from, to, promotion: promo }); lastMove = { from, to }; } catch {}
  }
  thinking = false;
  render();
}

// ---------- controls ----------
function newGame(color) {
  game.reset();
  humanColor = color;
  selected = null; lastMove = null; thinking = false;
  render();
  if (game.turn() !== humanColor) { thinking = true; updateStatus(); setTimeout(botMove, 450); }
}

document.getElementById('new-white').addEventListener('click', () => newGame('w'));
document.getElementById('new-black').addEventListener('click', () => newGame('b'));
document.getElementById('undo').addEventListener('click', () => {
  if (thinking) return;
  game.undo(); game.undo();               // undo bot + human
  selected = null;
  const h = game.history({ verbose: true });
  lastMove = h.length ? { from: h[h.length-1].from, to: h[h.length-1].to } : null;
  render();
});

// ---------- boot ----------
initStockfish();
render();
fetch('book.json')
  .then(r => r.ok ? r.json() : {})
  .then(b => { book = b; })
  .catch(() => { book = {}; });
