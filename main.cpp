/*
  SparkChess v15.0 (Stockfish 11 HCE Architecture)
  Upgraded from SparkChess 1.4.1 HCE with Stockfish 11 Core Modules:
  - Position & StateInfo incremental state machine
  - Pawn Hash Table (pawns.cpp/.h) & Material Imbalance Hash Table (material.cpp/.h)
  - Staged MovePicker with SEE (movepick.cpp/.h)
  - Specialized Endgames & KPK Bitbase (endgame.cpp/.h, bitbase.cpp)
  - Syzygy WDL/DTZ Tablebase Probing (syzygy/tbprobe.cpp/.h)
  - Lazy SMP Multi-Threading (thread.cpp/.h) & Dynamic Time Management (timeman.cpp/.h)
  - Polyglot Opening Book (book.cpp/.h) & Texel/SPSA HCE Tuner (trainer.cpp/.h)
*/

#include <iostream>

#include "bitboard.h"
#include "position.h"
#include "search.h"
#include "thread.h"
#include "tt.h"
#include "uci.h"
#include "endgame.h"
#include "evaluate.h"
#include "book.h"
#include "syzygy/tbprobe.h"

namespace PSQT {
  void init();
}

int main(int argc, char* argv[]) {

  std::cout << engine_info() << std::endl;

  UCI::init(Options);
  PSQT::init();
  Bitboards::init();
  Position::init();
  Bitbases::init();
  Endgames::init();
  Book::init_polyglot();
  Eval::load_eval_params("HCE1.bin");

  Threads.set(Options["Threads"]);
  Search::clear(); // After threads are up

  UCI::loop(argc, argv);

  Threads.set(0);
  return 0;
}
