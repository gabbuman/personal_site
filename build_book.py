"""Build a client-side opening book from Shubh's real chess.com games.

For every position where it was *his* turn during the opening, record the move
he actually played and how often. The browser bot samples from this so it opens
with Shubh's real repertoire, then hands off to Stockfish.

Output: web/book.json  ->  { "<fen-prefix>": [["e2e4", 412], ["d2d4", 88]], ... }
where fen-prefix is the first field (piece placement) + side-to-move + castling.
"""
from __future__ import annotations
import io, json, sys, urllib.request
from collections import defaultdict
import chess, chess.pgn

USER = "mesukatchess1"
MAX_PLIES = 16          # first 8 moves each side
MIN_COUNT = 2           # drop one-off moves (blunders / noise)
UA = "shubh-portfolio-bookbuilder/1.0"

def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def key(board: chess.Board) -> str:
    # position identity that ignores move counters: placement + stm + castling + ep
    parts = board.fen().split(" ")
    return " ".join(parts[:4])

def main() -> None:
    archives = json.loads(get(f"https://api.chess.com/pub/player/{USER}/games/archives"))["archives"]
    print(f"{len(archives)} monthly archives", file=sys.stderr)
    book: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    games = 0
    for i, url in enumerate(archives, 1):
        try:
            pgn_text = get(url + "/pgn").decode("utf-8", "replace")
        except Exception as e:
            print(f"  skip {url}: {e}", file=sys.stderr)
            continue
        stream = io.StringIO(pgn_text)
        while True:
            game = chess.pgn.read_game(stream)
            if game is None:
                break
            white = game.headers.get("White", "")
            black = game.headers.get("Black", "")
            if white.lower() == USER:
                my_color = chess.WHITE
            elif black.lower() == USER:
                my_color = chess.BLACK
            else:
                continue
            games += 1
            board = game.board()
            for ply, move in enumerate(game.mainline_moves()):
                if ply >= MAX_PLIES:
                    break
                if board.turn == my_color:
                    book[key(board)][move.uci()] += 1
                board.push(move)
        print(f"  [{i}/{len(archives)}] {games} games, {len(book)} positions", file=sys.stderr)

    out: dict[str, list] = {}
    for fen, moves in book.items():
        ranked = sorted(((m, c) for m, c in moves.items() if c >= MIN_COUNT),
                        key=lambda x: -x[1])
        if ranked:
            out[fen] = ranked
    with open("book.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"\nDONE: {games} games -> {len(out)} book positions, "
          f"{sum(len(v) for v in out.values())} moves", file=sys.stderr)

if __name__ == "__main__":
    main()
