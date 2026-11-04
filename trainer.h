#ifndef TRAINER_H_INCLUDED
#define TRAINER_H_INCLUDED

#include "types.h"
#include "position.h"
#include "evaluate.h"
#include <string>
#include <vector>
#include <cstdint>

struct TuningSample {
    std::string fen;
    float outcome = 0.5f; // 1.0 = White win, 0.5 = Draw, 0.0 = Black win
};

class HCETuner {
public:
    HCETuner() = default;

    int load_dataset(const std::string& path, std::vector<TuningSample>& dataset, int max_limit = 0);
    int load_epd(const std::string& epd_path, std::vector<TuningSample>& dataset, int max_positions = 0);
    int load_pgn(const std::string& pgn_path, std::vector<TuningSample>& dataset, int max_games = 0);

    double find_optimal_K(const std::vector<TuningSample>& dataset) const;
    double compute_texel_loss(const std::vector<TuningSample>& dataset, double K = 1.13) const;

    void tune_texel(std::vector<TuningSample>& dataset, int epochs, float lr, const std::string& output_file);
    void tune_spsa(int iterations, int games_per_iter, int depth, const std::string& output_file);

private:
    Move parse_san_move(const Position& pos, const std::string& san_raw) const;
};

extern HCETuner TUNER;

#endif // TRAINER_H_INCLUDED
