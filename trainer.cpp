#include "trainer.h"
#include "book.h"
#include "tt.h"
#include "search.h"
#include "thread.h"
#include "movegen.h"
#include "uci.h"
#include <fstream>
#include <iostream>
#include <iomanip>
#include <sstream>
#include <random>
#include <chrono>
#include <cmath>
#include <cctype>
#include <algorithm>
#include <deque>

HCETuner TUNER;

Move HCETuner::parse_san_move(const Position& pos, const std::string& san_raw) const {
    if (san_raw.empty()) return MOVE_NONE;

    std::string clean = san_raw;
    while (!clean.empty() && (clean.back() == '+' || clean.back() == '#' || clean.back() == '!' || clean.back() == '?')) {
        clean.pop_back();
    }
    if (clean.empty()) return MOVE_NONE;

    MoveList<LEGAL> legal(pos);

    // Direct UCI coordinate match
    for (const auto& ext : legal) {
        Move m = ext;
        if (UCI::move(m, pos.is_chess960()) == clean) return m;
    }

    // Castling
    if (clean == "O-O" || clean == "0-0") {
        for (const auto& ext : legal) {
            Move m = ext;
            if (type_of(m) == CASTLING && to_sq(m) > from_sq(m)) return m;
        }
    }
    if (clean == "O-O-O" || clean == "0-0-0") {
        for (const auto& ext : legal) {
            Move m = ext;
            if (type_of(m) == CASTLING && to_sq(m) < from_sq(m)) return m;
        }
    }

    PieceType promo_pt = NO_PIECE_TYPE;
    size_t eq_pos = clean.find('=');
    if (eq_pos != std::string::npos && eq_pos + 1 < clean.size()) {
        char pchar = clean[eq_pos + 1];
        if (pchar == 'Q') promo_pt = QUEEN;
        else if (pchar == 'R') promo_pt = ROOK;
        else if (pchar == 'B') promo_pt = BISHOP;
        else if (pchar == 'N') promo_pt = KNIGHT;
        clean = clean.substr(0, eq_pos);
    }

    if (clean.size() < 2) return MOVE_NONE;
    int to_file = clean[clean.size() - 2] - 'a';
    int to_rank = clean[clean.size() - 1] - '1';
    if (to_file < 0 || to_file > 7 || to_rank < 0 || to_rank > 7) return MOVE_NONE;
    Square target_sq = make_square(File(to_file), Rank(to_rank));

    PieceType moving_pt = PAWN;
    char first_char = clean[0];
    if (first_char == 'N') moving_pt = KNIGHT;
    else if (first_char == 'B') moving_pt = BISHOP;
    else if (first_char == 'R') moving_pt = ROOK;
    else if (first_char == 'Q') moving_pt = QUEEN;
    else if (first_char == 'K') moving_pt = KING;

    int disambig_file = -1;
    int disambig_rank = -1;
    size_t start_idx = (moving_pt == PAWN) ? 0 : 1;
    std::string prefix = clean.substr(start_idx, clean.size() - 2 - start_idx);
    for (char c : prefix) {
        if (c >= 'a' && c <= 'h') disambig_file = c - 'a';
        else if (c >= '1' && c <= '8') disambig_rank = c - '1';
    }

    for (const auto& ext : legal) {
        Move m = ext;
        if (type_of(m) == CASTLING) continue;
        if (to_sq(m) != target_sq) continue;
        if (type_of(pos.piece_on(from_sq(m))) != moving_pt) continue;
        if (promo_pt != NO_PIECE_TYPE && (type_of(m) != PROMOTION || promotion_type(m) != promo_pt)) continue;
        if (promo_pt == NO_PIECE_TYPE && type_of(m) == PROMOTION) continue;
        if (disambig_file != -1 && int(file_of(from_sq(m))) != disambig_file) continue;
        if (disambig_rank != -1 && int(rank_of(from_sq(m))) != disambig_rank) continue;
        return m;
    }

    return MOVE_NONE;
}

static bool parse_epd_outcome(const std::string& meta, float& out_result) {
    if (meta.find("1/2-1/2") != std::string::npos || meta.find("0.5") != std::string::npos) {
        out_result = 0.5f;
        return true;
    }
    if (meta.find("1-0") != std::string::npos || meta.find("[1.0]") != std::string::npos ||
        meta.find("\"1.0\"") != std::string::npos || meta.find("[1]") != std::string::npos) {
        out_result = 1.0f;
        return true;
    }
    if (meta.find("0-1") != std::string::npos || meta.find("[0.0]") != std::string::npos ||
        meta.find("\"0.0\"") != std::string::npos || meta.find("[0]") != std::string::npos) {
        out_result = 0.0f;
        return true;
    }
    return false;
}

int HCETuner::load_epd(const std::string& epd_path, std::vector<TuningSample>& dataset, int max_positions) {
    std::ifstream file(epd_path);
    if (!file.is_open()) {
        file.open("../" + epd_path);
    }
    if (!file.is_open()) return 0;

    int count = 0;
    std::string line;
    while (std::getline(file, line)) {
        if (max_positions > 0 && count >= max_positions) break;
        if (line.empty() || line[0] == '#') continue;

        std::istringstream ss(line);
        std::string f1, f2, f3, f4;
        if (!(ss >> f1 >> f2 >> f3 >> f4)) continue;
        std::string fen = f1 + " " + f2 + " " + f3 + " " + f4 + " 0 1";
        std::string rest;
        std::getline(ss, rest);

        float outcome = 0.5f;
        if (!parse_epd_outcome(rest.empty() ? line : rest, outcome)) continue;

        dataset.push_back({ fen, outcome });
        count++;
    }
    std::cout << "Loaded " << count << " quiet EPD positions from " << epd_path << "\n";
    return count;
}

int HCETuner::load_pgn(const std::string& pgn_path, std::vector<TuningSample>& dataset, int max_games) {
    std::ifstream file(pgn_path);
    if (!file.is_open()) {
        file.open("../" + pgn_path);
    }
    if (!file.is_open()) return 0;

    int games_loaded = 0;
    int samples_added = 0;
    float current_outcome = -1.0f;
    std::string move_text;
    std::string line;

    auto flush_game = [&]() {
        if (current_outcome < 0.0f || move_text.empty()) {
            move_text.clear();
            current_outcome = -1.0f;
            return;
        }

        Position pos;
        std::deque<StateInfo> states(1);
        pos.set("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", false, &states.back(), Threads.main());

        std::istringstream ms(move_text);
        std::string tok;
        int ply = 0;
        while (ms >> tok) {
            if (tok == "1-0" || tok == "0-1" || tok == "1/2-1/2" || tok == "*") break;
            if (tok[0] == '{' || tok[0] == '(') continue;
            size_t dot = tok.rfind('.');
            if (dot != std::string::npos) {
                if (dot + 1 >= tok.size()) continue;
                tok = tok.substr(dot + 1);
            }
            Move m = parse_san_move(pos, tok);
            if (m == MOVE_NONE) break;

            bool is_capture = pos.capture_or_promotion(m);
            states.emplace_back();
            pos.do_move(m, states.back());
            ply++;

            if (ply >= 14 && !is_capture && !pos.checkers() && (ply % 3 == 0)) {
                dataset.push_back({ pos.fen(), current_outcome });
                samples_added++;
            }
        }
        games_loaded++;
        move_text.clear();
        current_outcome = -1.0f;
    };

    while (std::getline(file, line)) {
        if (max_games > 0 && games_loaded >= max_games) break;
        if (line.empty()) continue;

        if (line[0] == '[') {
            if (line.find("[Event ") == 0 && !move_text.empty()) {
                flush_game();
                if (max_games > 0 && games_loaded >= max_games) break;
            }
            if (line.find("[Result ") == 0) {
                if (line.find("1-0") != std::string::npos) current_outcome = 1.0f;
                else if (line.find("0-1") != std::string::npos) current_outcome = 0.0f;
                else if (line.find("1/2-1/2") != std::string::npos) current_outcome = 0.5f;
            }
        } else {
            move_text += " " + line;
        }
    }
    if (!move_text.empty() && (max_games <= 0 || games_loaded < max_games)) {
        flush_game();
    }

    std::cout << "Loaded " << games_loaded << " PGN games (" << samples_added << " quiet SF11 samples) from " << pgn_path << "\n";
    return samples_added;
}

int HCETuner::load_dataset(const std::string& path, std::vector<TuningSample>& dataset, int max_limit) {
    if (path.find(".pgn") != std::string::npos) {
        return load_pgn(path, dataset, max_limit);
    }
    return load_epd(path, dataset, max_limit);
}

double HCETuner::compute_texel_loss(const std::vector<TuningSample>& dataset, double K) const {
    if (dataset.empty()) return 0.0;
    double total_err = 0.0;
    int valid_count = 0;

    Position pos;
    StateInfo st;
    Thread* th = Threads.main();

    for (const auto& sample : dataset) {
        pos.set(sample.fen, false, &st, th);
        if (pos.checkers()) continue;

        Value raw_v = Eval::evaluate(pos);
        // Convert to White perspective in centipawns
        double wp_cp = (pos.side_to_move() == WHITE ? double(raw_v) : -double(raw_v)) * 100.0 / double(PawnValueEg);
        double pred = 1.0 / (1.0 + std::pow(10.0, -K * wp_cp / 400.0));
        double diff = double(sample.outcome) - pred;
        total_err += diff * diff;
        valid_count++;
    }
    return valid_count > 0 ? (total_err / valid_count) : 0.0;
}

double HCETuner::find_optimal_K(const std::vector<TuningSample>& dataset) const {
    double best_K = 1.13;
    double best_loss = 1e9;
    for (int i = 50; i <= 200; i += 5) {
        double k = i / 100.0;
        double loss = compute_texel_loss(dataset, k);
        if (loss < best_loss) {
            best_loss = loss;
            best_K = k;
        }
    }
    return best_K;
}

void HCETuner::tune_texel(std::vector<TuningSample>& dataset, int epochs, float lr, const std::string& output_file) {
    if (dataset.empty()) {
        std::cout << "Texel tuner: dataset is empty.\n";
        return;
    }

    double K = find_optimal_K(dataset);
    double init_loss = compute_texel_loss(dataset, K);
    std::cout << "Starting SF11 Texel Tuning on " << dataset.size() << " positions | Optimal K=" << K
              << " | Initial MSE=" << std::fixed << std::setprecision(6) << init_loss << "\n";

    std::vector<int*> params = {
        &Eval::HCE_PARAMS.pawn_mg, &Eval::HCE_PARAMS.pawn_eg,
        &Eval::HCE_PARAMS.knight_mg, &Eval::HCE_PARAMS.knight_eg,
        &Eval::HCE_PARAMS.bishop_mg, &Eval::HCE_PARAMS.bishop_eg,
        &Eval::HCE_PARAMS.rook_mg, &Eval::HCE_PARAMS.rook_eg,
        &Eval::HCE_PARAMS.queen_mg, &Eval::HCE_PARAMS.queen_eg,
        &Eval::HCE_PARAMS.pawn_structure_scale_pct,
        &Eval::HCE_PARAMS.imbalance_scale_pct,
        &Eval::HCE_PARAMS.mobility_scale_pct,
        &Eval::HCE_PARAMS.king_safety_scale_pct,
        &Eval::HCE_PARAMS.threats_scale_pct,
        &Eval::HCE_PARAMS.passed_pawns_scale_pct,
        &Eval::HCE_PARAMS.space_scale_pct,
        &Eval::HCE_PARAMS.initiative_scale_pct,
        &Eval::HCE_PARAMS.tempo_bonus
    };

    int step = std::max(1, int(std::round(lr * 500.0f)));
    for (int ep = 1; ep <= epochs; ++ep) {
        double curr_loss = compute_texel_loss(dataset, K);
        for (size_t i = 0; i < params.size(); ++i) {
            int orig = *params[i];
            *params[i] = orig + step;
            Eval::apply_tunable_params();
            double loss_plus = compute_texel_loss(dataset, K);

            if (loss_plus < curr_loss) {
                curr_loss = loss_plus;
                continue;
            }

            *params[i] = std::max(1, orig - step);
            Eval::apply_tunable_params();
            double loss_minus = compute_texel_loss(dataset, K);

            if (loss_minus < curr_loss) {
                curr_loss = loss_minus;
            } else {
                *params[i] = orig;
                Eval::apply_tunable_params();
            }
        }
        std::cout << "Epoch " << ep << "/" << epochs << " | MSE Loss: " << std::fixed << std::setprecision(6)
                  << curr_loss << " | PawnMG=" << Eval::HCE_PARAMS.pawn_mg
                  << " KnightMG=" << Eval::HCE_PARAMS.knight_mg
                  << " MobilityScale=" << Eval::HCE_PARAMS.mobility_scale_pct << "%\n";
    }

    Eval::save_eval_params(output_file);
    std::cout << "Saved Texel-tuned SF11 HCE parameters to " << output_file << "\n";
}

void HCETuner::tune_spsa(int iterations, int games_per_iter, int /*depth*/, const std::string& output_file) {
    std::mt19937 rng(1337);
    std::uniform_int_distribution<int> coin(0, 1);

    std::vector<int*> params = {
        &Eval::HCE_PARAMS.pawn_mg, &Eval::HCE_PARAMS.pawn_eg,
        &Eval::HCE_PARAMS.knight_mg, &Eval::HCE_PARAMS.knight_eg,
        &Eval::HCE_PARAMS.bishop_mg, &Eval::HCE_PARAMS.bishop_eg,
        &Eval::HCE_PARAMS.rook_mg, &Eval::HCE_PARAMS.rook_eg,
        &Eval::HCE_PARAMS.pawn_structure_scale_pct,
        &Eval::HCE_PARAMS.mobility_scale_pct,
        &Eval::HCE_PARAMS.king_safety_scale_pct,
        &Eval::HCE_PARAMS.passed_pawns_scale_pct
    };

    const char* test_fens[] = {
        "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
        "rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ - 3 6",
        "r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1 w - - 6 8",
        "8/5pk1/R6p/2p1p1p1/8/1P3P1P/2P2KP1/5r2 w - - 0 32"
    };

    for (int it = 1; it <= iterations; ++it) {
        std::vector<int> delta(params.size());
        std::vector<int> base_vals(params.size());
        int c_k = std::max(1, 5 - it / 4);

        for (size_t i = 0; i < params.size(); ++i) {
            base_vals[i] = *params[i];
            delta[i] = coin(rng) ? 1 : -1;
        }

        double score_plus = 0.0;
        for (int g = 0; g < games_per_iter; ++g) {
            Position pos;
            StateInfo st;
            pos.set(test_fens[g % 4], false, &st, Threads.main());

            for (size_t i = 0; i < params.size(); ++i) *params[i] = base_vals[i] + c_k * delta[i];
            Eval::apply_tunable_params();
            int eval_plus = int(Eval::evaluate(pos));

            for (size_t i = 0; i < params.size(); ++i) *params[i] = base_vals[i] - c_k * delta[i];
            Eval::apply_tunable_params();
            int eval_minus = int(Eval::evaluate(pos));

            score_plus += (eval_plus >= eval_minus) ? 1.0 : -1.0;
        }

        double grad_scale = score_plus / std::max(1, games_per_iter);
        for (size_t i = 0; i < params.size(); ++i) {
            *params[i] = std::max(10, base_vals[i] + int(std::round(grad_scale * delta[i])));
        }
        Eval::apply_tunable_params();
        std::cout << "SPSA Iteration " << it << "/" << iterations
                  << " | PawnMG=" << Eval::HCE_PARAMS.pawn_mg
                  << " KnightMG=" << Eval::HCE_PARAMS.knight_mg
                  << " MobilityScale=" << Eval::HCE_PARAMS.mobility_scale_pct << "%\n";
    }

    Eval::save_eval_params(output_file);
    std::cout << "Saved SPSA-tuned SF11 HCE parameters to " << output_file << "\n";
}
