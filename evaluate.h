/*
  Stockfish, a UCI chess playing engine derived from Glaurung 2.1
  Copyright (C) 2004-2008 Tord Romstad (Glaurung author)
  Copyright (C) 2008-2015 Marco Costalba, Joona Kiiski, Tord Romstad
  Copyright (C) 2015-2020 Marco Costalba, Joona Kiiski, Gary Linscott, Tord Romstad

  Upgraded for SparkChess v15 (SF11-HCE Architecture) with Texel/SPSA Tunable Weights.
*/

#ifndef EVALUATE_H_INCLUDED
#define EVALUATE_H_INCLUDED

#include <string>
#include <cstdint>

#include "types.h"

class Position;

namespace PSQT {
  void init();
}

namespace Eval {

  constexpr Value Tempo = Value(28); // Must be visible to search

  // Stockfish 11 Tunable HCE Parameters for Texel / SPSA Optimization & Weight Persistence
  struct SF11TunableParams {
    uint32_t magic_header = 0x53463131; // "SF11"
    int pawn_mg   = PawnValueMg;        // 128
    int pawn_eg   = PawnValueEg;        // 213
    int knight_mg = KnightValueMg;      // 781
    int knight_eg = KnightValueEg;      // 854
    int bishop_mg = BishopValueMg;      // 825
    int bishop_eg = BishopValueEg;      // 915
    int rook_mg   = RookValueMg;        // 1276
    int rook_eg   = RookValueEg;        // 1380
    int queen_mg  = QueenValueMg;       // 2538
    int queen_eg  = QueenValueEg;       // 2682

    // Category percentage scales (100 = 100% pure Stockfish 11 baseline)
    int pawn_structure_scale_pct = 100;
    int imbalance_scale_pct      = 100;
    int mobility_scale_pct       = 100;
    int king_safety_scale_pct    = 100;
    int threats_scale_pct        = 100;
    int passed_pawns_scale_pct   = 100;
    int space_scale_pct          = 100;
    int initiative_scale_pct     = 100;
    int tempo_bonus              = 28;
  };

  extern SF11TunableParams HCE_PARAMS;

  void apply_tunable_params();
  bool save_eval_params(const std::string& filepath);
  bool load_eval_params(const std::string& filepath);

  std::string trace(const Position& pos);
  Value evaluate(const Position& pos);

} // namespace Eval

#endif // #ifndef EVALUATE_H_INCLUDED
