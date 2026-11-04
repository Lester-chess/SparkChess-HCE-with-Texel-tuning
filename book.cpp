#include "book.h"
#include "polyglot_keys.h"
#include "movegen.h"
#include "uci.h"
#include <fstream>
#include <vector>
#include <random>
#include <chrono>
#include <algorithm>
#include <iostream>

namespace Book {

void init_polyglot() {
    // Official 781 Polyglot random keys are constexpr in polyglot_keys.h
}

// Compute official Polyglot Zobrist 64-bit hash key from Stockfish 11 Position
uint64_t compute_polyglot_key(const Position& pos) {
    uint64_t key = 0;
    for (Square sq = SQ_A1; sq <= SQ_H8; ++sq) {
        Piece p = pos.piece_on(sq);
        if (p != NO_PIECE) {
            // In Stockfish 11: PAWN=1, KNIGHT=2, BISHOP=3, ROOK=4, QUEEN=5, KING=6
            // Polyglot piece index (0..11):
            // black pawn=0, white pawn=1, black knight=2, white knight=3,
            // black bishop=4, white bishop=5, black rook=6, white rook=7,
            // black queen=8, white queen=9, black king=10, white king=11
            int pt_zero_based = int(type_of(p)) - int(PAWN);
            int poly_piece = (pt_zero_based * 2) + (color_of(p) == WHITE ? 1 : 0);
            key ^= POLYGLOT_RANDOM_64[64 * poly_piece + int(sq)];
        }
    }

    // Castling rights
    if (pos.can_castle(WHITE_OO))  key ^= POLYGLOT_RANDOM_64[768 + 0];
    if (pos.can_castle(WHITE_OOO)) key ^= POLYGLOT_RANDOM_64[768 + 1];
    if (pos.can_castle(BLACK_OO))  key ^= POLYGLOT_RANDOM_64[768 + 2];
    if (pos.can_castle(BLACK_OOO)) key ^= POLYGLOT_RANDOM_64[768 + 3];

    // En passant file (Position::ep_square() is only set when an enemy pawn can legally capture)
    Square ep = pos.ep_square();
    if (ep != SQ_NONE) {
        key ^= POLYGLOT_RANDOM_64[772 + int(file_of(ep))];
    }

    // Turn: XOR 780 if White to move
    if (pos.side_to_move() == WHITE) {
        key ^= POLYGLOT_RANDOM_64[780];
    }

    return key;
}

// Convert Polyglot 16-bit raw move to Stockfish 11 Move
static Move polyglot_move_to_engine(uint16_t poly_move, const Position& pos) {
    int to_f = poly_move & 0x7;
    int to_r = (poly_move >> 3) & 0x7;
    int from_f = (poly_move >> 6) & 0x7;
    int from_r = (poly_move >> 9) & 0x7;
    int promo = (poly_move >> 12) & 0x7;

    Square raw_from = make_square(File(from_f), Rank(from_r));
    Square raw_to   = make_square(File(to_f), Rank(to_r));
    Square uci_to   = raw_to;

    // Polyglot and Stockfish 11 both represent castling internally as king captures own rook
    // (e1h1, e1a1, e8h8, e8a8), while UCI string uses e1g1, e1c1, e8g8, e8c8
    Piece moving_p = pos.piece_on(raw_from);
    if (moving_p != NO_PIECE && type_of(moving_p) == KING) {
        if (raw_from == SQ_E1 && raw_to == SQ_H1) uci_to = SQ_G1;
        else if (raw_from == SQ_E1 && raw_to == SQ_A1) uci_to = SQ_C1;
        else if (raw_from == SQ_E8 && raw_to == SQ_H8) uci_to = SQ_G8;
        else if (raw_from == SQ_E8 && raw_to == SQ_A8) uci_to = SQ_C8;
    }

    for (const auto& ext : MoveList<LEGAL>(pos)) {
        Move m = ext;
        bool sq_match = (from_sq(m) == raw_from && (to_sq(m) == raw_to || to_sq(m) == uci_to));
        if (sq_match) {
            if (promo != 0) {
                PieceType pt = KNIGHT;
                if (promo == 1) pt = KNIGHT;
                else if (promo == 2) pt = BISHOP;
                else if (promo == 3) pt = ROOK;
                else if (promo == 4) pt = QUEEN;
                if (type_of(m) == PROMOTION && promotion_type(m) == pt)
                    return m;
            } else if (type_of(m) != PROMOTION) {
                return m;
            }
        }
    }
    return MOVE_NONE;
}

#pragma pack(push, 1)
struct PolyglotEntry {
    uint64_t key;
    uint16_t move;
    uint16_t weight;
    uint32_t learn;
};
#pragma pack(pop)

struct BuiltinBookEntry {
    uint64_t key;
    uint16_t raw_move;
    uint16_t weight;
};

static constexpr int BUILTIN_BOOK_SIZE = 344;
static constexpr BuiltinBookEntry BUILTIN_POLYGLOT_BOOK[BUILTIN_BOOK_SIZE] = {
    { 0x018137fd250fad8dULL, 0x0107, 30 },
    { 0x02c62b7c7eab525bULL, 0x00cc, 35 },
    { 0x0391553073dce241ULL, 0x015a, 30 },
    { 0x03b46bc633c27a2bULL, 0x0dae, 30 },
    { 0x06649ba69b8c9ff8ULL, 0x029a, 200 },
    { 0x06649ba69b8c9ff8ULL, 0x009d, 35 },
    { 0x06b2ee1ca04ad790ULL, 0x049b, 25 },
    { 0x07a7ee1102432674ULL, 0x0fad, 90 },
    { 0x0844931a6ef4b9a0ULL, 0x0195, 220 },
    { 0x09a2250f4dfc8f82ULL, 0x0094, 50 },
    { 0x09a2250f4dfc8f82ULL, 0x00a6, 40 },
    { 0x0b0b0d130d9411edULL, 0x0723, 35 },
    { 0x0be1ff05927f1410ULL, 0x0195, 50 },
    { 0x0c49cea41e90fd12ULL, 0x0107, 80 },
    { 0x0c6b7b93635b96c6ULL, 0x089b, 35 },
    { 0x0c927a821fd69c9cULL, 0x04da, 40 },
    { 0x0e525b1311587325ULL, 0x0ce3, 45 },
    { 0x0ecfb671f56f0a18ULL, 0x014e, 40 },
    { 0x0f372983dd8e7550ULL, 0x0915, 25 },
    { 0x0faaee392938103dULL, 0x00a6, 40 },
    { 0x104676bf8ad1922dULL, 0x02db, 75 },
    { 0x106291f6789ae1e6ULL, 0x0314, 50 },
    { 0x106b7c2058877f45ULL, 0x0107, 25 },
    { 0x10b5fab4b5ef1d51ULL, 0x004b, 35 },
    { 0x10fd4254dfedaf8bULL, 0x0107, 35 },
    { 0x1104e063b1834f56ULL, 0x0c28, 35 },
    { 0x1297b266d226456dULL, 0x0fad, 25 },
    { 0x13a0cb4b08c808c4ULL, 0x0c61, 40 },
    { 0x14061a8c293eef5aULL, 0x0292, 50 },
    { 0x146d4888073671efULL, 0x00a6, 40 },
    { 0x14c47eea7b218ed5ULL, 0x02db, 40 },
    { 0x1557dbfdb09fd564ULL, 0x0314, 40 },
    { 0x160a5893b400fecaULL, 0x0f74, 35 },
    { 0x183558fae2a3d387ULL, 0x0396, 35 },
    { 0x183de96daf43e744ULL, 0x0195, 80 },
    { 0x1afceb8e7efa9771ULL, 0x06ea, 30 },
    { 0x1b0748fc7e923329ULL, 0x0850, 40 },
    { 0x1b7e13263fc0ab38ULL, 0x0f62, 45 },
    { 0x1b7e13263fc0ab38ULL, 0x0fad, 35 },
    { 0x1b7fc8b31a2528a2ULL, 0x0d2c, 35 },
    { 0x1cb8a5f6d4f5263fULL, 0x055b, 125 },
    { 0x1d04fbb4fd4bf2e8ULL, 0x0c61, 50 },
    { 0x1f6a1ab5c4f32fcfULL, 0x014c, 35 },
    { 0x20b968c21961ced2ULL, 0x0b5c, 40 },
    { 0x20c2cc5e683ef587ULL, 0x0052, 125 },
    { 0x217c9925598d53b0ULL, 0x0fb4, 35 },
    { 0x22b4e052f18fab1dULL, 0x0052, 50 },
    { 0x22b4e052f18fab1dULL, 0x0396, 45 },
    { 0x22b4e052f18fab1dULL, 0x0195, 40 },
    { 0x23d575f7bd002e53ULL, 0x0107, 50 },
    { 0x23f2bc8ff1c7981fULL, 0x0f3f, 50 },
    { 0x24e0fb29c79abdacULL, 0x0e6a, 50 },
    { 0x265d46d82aea23b8ULL, 0x014c, 30 },
    { 0x26868226c23144c9ULL, 0x055b, 30 },
    { 0x2800906e7bc2229fULL, 0x0b63, 25 },
    { 0x2925603da4c97a68ULL, 0x089b, 25 },
    { 0x295a5138249e71f4ULL, 0x0195, 50 },
    { 0x2a0429950aca49ebULL, 0x0195, 45 },
    { 0x2bf30b608b49bca9ULL, 0x0ca2, 35 },
    { 0x2c69d892aad95ce6ULL, 0x0195, 35 },
    { 0x2c8280b71b7b26daULL, 0x015a, 35 },
    { 0x2cd4075ed7fb53ebULL, 0x0ee3, 35 },
    { 0x2cf5ab6fffb3ca53ULL, 0x0f3f, 30 },
    { 0x2d401dd965fe75deULL, 0x035d, 40 },
    { 0x2dbc8cedfb46a637ULL, 0x0ceb, 50 },
    { 0x301b3c500681d1f8ULL, 0x0355, 50 },
    { 0x30b81df53cd832edULL, 0x086a, 35 },
    { 0x31606dfc03d2d72dULL, 0x0ea5, 35 },
    { 0x317e46cbf4fafc86ULL, 0x0ce3, 75 },
    { 0x325b696440075d7dULL, 0x0ceb, 50 },
    { 0x32e187a7d153e515ULL, 0x0094, 35 },
    { 0x346682e098fa10c0ULL, 0x0def, 35 },
    { 0x34d3e3bb02740bbfULL, 0x0fad, 35 },
    { 0x34e19cfb0f9e6d2eULL, 0x0e6a, 35 },
    { 0x35f358c5cce8b47fULL, 0x0ceb, 80 },
    { 0x36107858fb405950ULL, 0x0ceb, 40 },
    { 0x368dbfe20ff63c3dULL, 0x0ceb, 25 },
    { 0x36c262e8e9509afbULL, 0x0ea5, 35 },
    { 0x37e81b1804b32028ULL, 0x096e, 40 },
    { 0x39572234d098bb47ULL, 0x0314, 40 },
    { 0x395ab6458080b18cULL, 0x0af1, 35 },
    { 0x3a469e6b28127b47ULL, 0x0c69, 50 },
    { 0x3b053218f098d5c5ULL, 0x0c61, 30 },
    { 0x3b7dc1d7c1850ddfULL, 0x0e6a, 40 },
    { 0x3bde4b0aa6685f94ULL, 0x0def, 40 },
    { 0x3ec85a7ac061e57aULL, 0x0f74, 45 },
    { 0x3facb0e737302533ULL, 0x0195, 35 },
    { 0x40600176c67bafadULL, 0x0052, 40 },
    { 0x409027d3923aeaaeULL, 0x02d3, 35 },
    { 0x4090319380cc952aULL, 0x0756, 35 },
    { 0x4112df7bd300d6e7ULL, 0x0fad, 30 },
    { 0x41e93c4b5069fe9bULL, 0x0f76, 35 },
    { 0x4329a05d1c98bbf9ULL, 0x0292, 35 },
    { 0x43a61fc3a9014ff9ULL, 0x089b, 125 },
    { 0x4499fd05fcc5f991ULL, 0x0f74, 40 },
    { 0x45284ee920e59f57ULL, 0x0c61, 40 },
    { 0x463b96181691fc9cULL, 0x031c, 595 },
    { 0x463b96181691fc9cULL, 0x02db, 495 },
    { 0x463b96181691fc9cULL, 0x029a, 75 },
    { 0x463b96181691fc9cULL, 0x0195, 35 },
    { 0x46e0599a50c02bddULL, 0x0f76, 50 },
    { 0x46e0599a50c02bddULL, 0x0ce3, 45 },
    { 0x472d7a2f6c1260c4ULL, 0x0f76, 30 },
    { 0x48b719dc95a341ebULL, 0x0107, 35 },
    { 0x49029a7f69359b30ULL, 0x0d24, 40 },
    { 0x497986937fdc04fbULL, 0x0724, 25 },
    { 0x49db42d62f12b561ULL, 0x0d2c, 35 },
    { 0x4adfabd7fbc45bdaULL, 0x0716, 40 },
    { 0x4b1376a17217ee1dULL, 0x0c28, 50 },
    { 0x4b1376a17217ee1dULL, 0x0fad, 35 },
    { 0x4c4595724944c61dULL, 0x0ab4, 50 },
    { 0x4f31349f3338f07cULL, 0x08eb, 35 },
    { 0x4f837c7daacc3079ULL, 0x0fad, 40 },
    { 0x50197b0107ccf149ULL, 0x0052, 40 },
    { 0x50197b0107ccf149ULL, 0x0724, 35 },
    { 0x50558eea366e5500ULL, 0x00d5, 40 },
    { 0x524e9a0ed13f6cbaULL, 0x031c, 45 },
    { 0x526341290d7773ffULL, 0x0b23, 40 },
    { 0x5375c1a61eafff00ULL, 0x055b, 35 },
    { 0x54c31263e9ad3b4fULL, 0x0d2c, 135 },
    { 0x54c31263e9ad3b4fULL, 0x0dae, 95 },
    { 0x55155984c0b5cd89ULL, 0x06a3, 35 },
    { 0x55ddc5212bcf691bULL, 0x0ceb, 30 },
    { 0x567e57d109ee9e44ULL, 0x0c6a, 30 },
    { 0x57741833ad27fe94ULL, 0x0e6a, 35 },
    { 0x57bb6ad299b8f4ceULL, 0x00ca, 45 },
    { 0x58413db08abdda1cULL, 0x0195, 30 },
    { 0x592a0b6b575327ebULL, 0x0f76, 45 },
    { 0x59f6079c20f57796ULL, 0x0314, 40 },
    { 0x5a95801dbb6966bcULL, 0x0107, 50 },
    { 0x5b3fc249627bd994ULL, 0x0b63, 35 },
    { 0x5c49dae4afb967e2ULL, 0x00a6, 50 },
    { 0x5c49dae4afb967e2ULL, 0x06a3, 40 },
    { 0x5da00ec3c1f3f543ULL, 0x0e6a, 50 },
    { 0x5eaada61a64b3e89ULL, 0x0f74, 50 },
    { 0x5ec5790ad4c52927ULL, 0x09b4, 40 },
    { 0x5ee40d16dc1f5eacULL, 0x0f74, 35 },
    { 0x5f09e211257e88a0ULL, 0x0107, 35 },
    { 0x60c9f6a8dbac59dcULL, 0x099f, 50 },
    { 0x619727139a8ee2d6ULL, 0x0c6a, 35 },
    { 0x6284639ab0a605f5ULL, 0x014c, 35 },
    { 0x62dce214f94ee0dcULL, 0x0f3f, 50 },
    { 0x6304fcaa0cd7c3c0ULL, 0x049c, 40 },
    { 0x632029cca8bd4536ULL, 0x08da, 40 },
    { 0x632029cca8bd4536ULL, 0x0d2c, 40 },
    { 0x644d4afe02564aebULL, 0x0195, 200 },
    { 0x644d4afe02564aebULL, 0x0292, 25 },
    { 0x649b5cbbdced4af4ULL, 0x0ef2, 35 },
    { 0x64a3ae844e34aaf0ULL, 0x0eac, 50 },
    { 0x66cd047cb51c2bd1ULL, 0x0f59, 40 },
    { 0x6780bd452cc80cfcULL, 0x0195, 50 },
    { 0x691de884dcd1bf9dULL, 0x0d2c, 35 },
    { 0x6c54535b7b10319aULL, 0x018c, 45 },
    { 0x6c675340f9b72076ULL, 0x03d7, 30 },
    { 0x6cea994cc5d6656cULL, 0x0e73, 35 },
    { 0x6d083a820207b8f0ULL, 0x004b, 35 },
    { 0x6d7798ed17d2b334ULL, 0x00a6, 40 },
    { 0x6e1e07142474a455ULL, 0x0f74, 25 },
    { 0x6e883960a31e749bULL, 0x0b5c, 35 },
    { 0x6f3dd74eaf8e4a29ULL, 0x014e, 35 },
    { 0x6fb8b81580d4b735ULL, 0x02db, 25 },
    { 0x71219b7990731cb1ULL, 0x08f2, 35 },
    { 0x716e460b49675dc1ULL, 0x00cc, 30 },
    { 0x723cb59062632602ULL, 0x0c28, 45 },
    { 0x723cb59062632602ULL, 0x0f3f, 35 },
    { 0x724dec9a595a77bcULL, 0x0e73, 40 },
    { 0x739c3a82668f4f1cULL, 0x089b, 35 },
    { 0x7537cb727b34b8c6ULL, 0x014e, 40 },
    { 0x75e6a7016bfe7213ULL, 0x0d2c, 30 },
    { 0x763bda08d93d13aeULL, 0x0195, 25 },
    { 0x76a18fe5099eb6e1ULL, 0x0f3f, 35 },
    { 0x78cda70e17837d9eULL, 0x0161, 85 },
    { 0x78cda70e17837d9eULL, 0x015a, 80 },
    { 0x78cda70e17837d9eULL, 0x02db, 30 },
    { 0x78f0b894533b3c64ULL, 0x0e6a, 45 },
    { 0x7aaa9ee3ccc6940cULL, 0x0d24, 50 },
    { 0x7b2cf8abc5c4b411ULL, 0x0fad, 125 },
    { 0x7d0091a166e64fd5ULL, 0x0611, 50 },
    { 0x7ff44cc959fc769dULL, 0x0c28, 30 },
    { 0x80b613693e6c9f72ULL, 0x0153, 40 },
    { 0x823c9b50fd114196ULL, 0x0ca2, 225 },
    { 0x823c9b50fd114196ULL, 0x0d24, 220 },
    { 0x823c9b50fd114196ULL, 0x0d2c, 75 },
    { 0x823c9b50fd114196ULL, 0x0caa, 75 },
    { 0x82acb71f1c886f60ULL, 0x015a, 40 },
    { 0x830eb9b20758d1deULL, 0x0fad, 260 },
    { 0x830eb9b20758d1deULL, 0x0ce3, 235 },
    { 0x8325d146e25bbb21ULL, 0x0fad, 30 },
    { 0x84948efe3b14e984ULL, 0x0e73, 30 },
    { 0x85bd53e0cb861a2dULL, 0x08da, 45 },
    { 0x86933069b8c862bbULL, 0x02db, 125 },
    { 0x86de49d2af16340dULL, 0x0314, 35 },
    { 0x88ce4b19abe8990bULL, 0x0564, 25 },
    { 0x8a2582f584573ae7ULL, 0x0ca2, 45 },
    { 0x8a470482d88334ffULL, 0x0d2c, 90 },
    { 0x8a470482d88334ffULL, 0x0caa, 80 },
    { 0x8a470482d88334ffULL, 0x08da, 30 },
    { 0x8b3879078d8c3d03ULL, 0x014e, 45 },
    { 0x8b99e2127468b00cULL, 0x0153, 40 },
    { 0x8be88f868c45d5cfULL, 0x0724, 30 },
    { 0x8d7c86d0b048f56dULL, 0x0f74, 50 },
    { 0x8edffe3dd59810bbULL, 0x0314, 50 },
    { 0x8eefeb75171cca51ULL, 0x055b, 40 },
    { 0x90901935d014a8dcULL, 0x0396, 40 },
    { 0x92b945b467ea7dbbULL, 0x0396, 40 },
    { 0x9336b945c62e5c68ULL, 0x0107, 35 },
    { 0x93bead31169a92dbULL, 0x015a, 25 },
    { 0x947a6086f4c733e3ULL, 0x0f74, 40 },
    { 0x94c0a45e30ef09dfULL, 0x072b, 35 },
    { 0x954c0a7bdebd33abULL, 0x00cb, 35 },
    { 0x964997463abfd1b0ULL, 0x08d2, 45 },
    { 0x98b7316e6a5fc7efULL, 0x0052, 80 },
    { 0x99b0f53f7ae359fcULL, 0x0144, 50 },
    { 0x99e48752953716c1ULL, 0x0858, 50 },
    { 0x9a138dd21f33bc2aULL, 0x0f74, 50 },
    { 0x9b1c43e2ad768db2ULL, 0x0566, 40 },
    { 0x9b579b1088780fabULL, 0x02d3, 45 },
    { 0x9d5f7aee7e779da1ULL, 0x0ce3, 35 },
    { 0x9f0c44191e0fc82dULL, 0x0052, 35 },
    { 0x9fe4e7cc0be4da40ULL, 0x0f3f, 35 },
    { 0xa0cb44638543dedeULL, 0x0218, 45 },
    { 0xa32c760f4040b759ULL, 0x0fad, 35 },
    { 0xa5c7490788b506fcULL, 0x06e4, 35 },
    { 0xa691c9860f2e59d5ULL, 0x00c4, 35 },
    { 0xa77dd7230d5726eaULL, 0x03df, 40 },
    { 0xa7827aac790920d2ULL, 0x0b73, 40 },
    { 0xa8e7c91161416febULL, 0x0fad, 50 },
    { 0xa8f8d6740e692e21ULL, 0x0195, 35 },
    { 0xa929006c31bc1681ULL, 0x0195, 40 },
    { 0xa9ad7dbd2ee5d665ULL, 0x0d24, 50 },
    { 0xaa043b50c4e2dbb6ULL, 0x0ceb, 25 },
    { 0xaa8d97bf911d9a77ULL, 0x0ae3, 25 },
    { 0xab2dcfdba75868fcULL, 0x0caa, 40 },
    { 0xab8e63a3c52e7390ULL, 0x08dc, 40 },
    { 0xace300916fc57c4dULL, 0x0052, 35 },
    { 0xad03bd3abedc8e41ULL, 0x00cc, 30 },
    { 0xad5f36feb1db7293ULL, 0x0e6a, 25 },
    { 0xaff3e6e372297ef0ULL, 0x0107, 40 },
    { 0xb12610fefa83abd5ULL, 0x0218, 40 },
    { 0xb2790472b437dea0ULL, 0x0195, 35 },
    { 0xb29582ddabd719e9ULL, 0x0052, 40 },
    { 0xb47ff5f5f5f241bbULL, 0x0292, 45 },
    { 0xb777f5a3dbbc0448ULL, 0x0107, 30 },
    { 0xb7e73ef3899c80a9ULL, 0x0153, 50 },
    { 0xb87a994f94c05dc0ULL, 0x0e73, 40 },
    { 0xb98f8008e554c418ULL, 0x035d, 40 },
    { 0xbb3f950cb882d261ULL, 0x0f74, 40 },
    { 0xbb582256a47eb852ULL, 0x0e6a, 35 },
    { 0xbb86a4c24916da46ULL, 0x0e6a, 25 },
    { 0xbbf719d404992d74ULL, 0x0fad, 40 },
    { 0xbc76a27430c370e4ULL, 0x0f59, 40 },
    { 0xbce451b3442e6dc1ULL, 0x0ca2, 50 },
    { 0xbd4fd3445cc56942ULL, 0x0f3f, 50 },
    { 0xbd5445f41f04ec0bULL, 0x0e6a, 35 },
    { 0xbd7741389222a904ULL, 0x0052, 95 },
    { 0xbd866aa42a506c9aULL, 0x0fad, 35 },
    { 0xbdf888a4064a50dcULL, 0x091b, 30 },
    { 0xbe5ffef5873da583ULL, 0x0eb1, 40 },
    { 0xbf29a6086ab02bd6ULL, 0x0ceb, 125 },
    { 0xbf29a6086ab02bd6ULL, 0x0e6a, 40 },
    { 0xbf29a6086ab02bd6ULL, 0x0d2c, 35 },
    { 0xc0b9afe525824e3dULL, 0x0fad, 45 },
    { 0xc0c7e80f36d960bfULL, 0x0f3f, 40 },
    { 0xc359059bc7a58679ULL, 0x0fad, 80 },
    { 0xc37a9235fad06306ULL, 0x06e1, 40 },
    { 0xc38a7b8ecc1465fbULL, 0x06a3, 45 },
    { 0xc3f3119056a3b78aULL, 0x0107, 35 },
    { 0xc4d1b804dd9ec4c8ULL, 0x014e, 35 },
    { 0xc6fb6c517d1706b6ULL, 0x0724, 40 },
    { 0xc9028e97a74fdf58ULL, 0x0ca2, 30 },
    { 0xc95e54397292bb84ULL, 0x02db, 35 },
    { 0xc9c6c2594c215257ULL, 0x0ea5, 40 },
    { 0xc9f0b90f99b2cbf5ULL, 0x0c28, 40 },
    { 0xca18093c559e579bULL, 0x0d24, 40 },
    { 0xca18093c559e579bULL, 0x0ca2, 35 },
    { 0xca6f05b8e3808954ULL, 0x0107, 40 },
    { 0xcb023a8fe8d00b10ULL, 0x0f3f, 45 },
    { 0xcd80c33c58adf2bbULL, 0x0ef4, 40 },
    { 0xcd82dace740eb7d4ULL, 0x0292, 35 },
    { 0xcda0e0436eda71e6ULL, 0x0b63, 45 },
    { 0xcdcea23704ba7516ULL, 0x0652, 40 },
    { 0xcff87239fd76544aULL, 0x0d2c, 40 },
    { 0xd05660d47c6f4857ULL, 0x0f3f, 40 },
    { 0xd07f7b905c6183afULL, 0x0ce3, 35 },
    { 0xd08513f3fa99752dULL, 0x0f3f, 50 },
    { 0xd1869dd70edaa5e0ULL, 0x0f3f, 40 },
    { 0xd1f151406ae8a397ULL, 0x089b, 40 },
    { 0xd20ff64c86031026ULL, 0x0b5c, 25 },
    { 0xd2371fbeb7bcaa27ULL, 0x0f74, 40 },
    { 0xd3207fec0612d89dULL, 0x0e6a, 195 },
    { 0xd3207fec0612d89dULL, 0x0fad, 25 },
    { 0xd33f7739a5c9d388ULL, 0x02db, 35 },
    { 0xd57359159b18bf6fULL, 0x0ce3, 75 },
    { 0xd5bbb2cb07ec5d01ULL, 0x0e73, 40 },
    { 0xd8cbe5b34fa1fab7ULL, 0x0314, 30 },
    { 0xd8e08d47aaa29048ULL, 0x029a, 230 },
    { 0xd8e08d47aaa29048ULL, 0x009d, 30 },
    { 0xd923f8f0336d29c4ULL, 0x0f59, 50 },
    { 0xda2dfe442fc09cc6ULL, 0x014c, 50 },
    { 0xdacdf433e2639250ULL, 0x0caa, 35 },
    { 0xdad8b9b6a13adff2ULL, 0x0252, 45 },
    { 0xdaef6e1297107e1bULL, 0x0ea5, 40 },
    { 0xdb2e7060db834c0bULL, 0x0052, 40 },
    { 0xdb55d4fcaadc775eULL, 0x0c28, 90 },
    { 0xdb55d4fcaadc775eULL, 0x0dae, 35 },
    { 0xdd307d2702ec759bULL, 0x0fad, 35 },
    { 0xdd590d3b3cb36c49ULL, 0x0107, 35 },
    { 0xde9443b04de8727fULL, 0x08da, 40 },
    { 0xe0192d21a9636ce2ULL, 0x0195, 40 },
    { 0xe2ea9f51b01c42daULL, 0x0ce3, 50 },
    { 0xe4c85c115fd6440eULL, 0x0f6b, 35 },
    { 0xe6a218cf8b6ec8aaULL, 0x0c28, 45 },
    { 0xe768c92907230645ULL, 0x0b63, 30 },
    { 0xe7f0e653da48a6f0ULL, 0x0ca2, 30 },
    { 0xe97bb628062d587fULL, 0x0fad, 40 },
    { 0xe99636ddac14ec41ULL, 0x015a, 45 },
    { 0xea00389d484de860ULL, 0x0314, 30 },
    { 0xea77f5d91a1303bbULL, 0x0ef2, 40 },
    { 0xea91997b885bf3abULL, 0x0ef4, 30 },
    { 0xec104f97b500572aULL, 0x02db, 25 },
    { 0xed43c271badd8778ULL, 0x0d24, 35 },
    { 0xed7adcbdf2d31a90ULL, 0x0ca2, 35 },
    { 0xee34e406d6aa517aULL, 0x0f62, 35 },
    { 0xee8b056070961835ULL, 0x0153, 25 },
    { 0xf00d19193ed9447dULL, 0x08e9, 25 },
    { 0xf0d296a95f236c3aULL, 0x06d1, 50 },
    { 0xf15501fdab2e3531ULL, 0x0355, 35 },
    { 0xf160c563622c28d6ULL, 0x0f3f, 45 },
    { 0xf23ebdce4c7810c9ULL, 0x0def, 50 },
    { 0xf309fde4ccbb2e7dULL, 0x0107, 50 },
    { 0xf44b6961e533d1c4ULL, 0x02db, 75 },
    { 0xf4db452e04aaff32ULL, 0x0d2c, 40 },
    { 0xf64dd621d0625040ULL, 0x06e3, 50 },
    { 0xf65c642cab87e077ULL, 0x031c, 50 },
    { 0xf70d3464c23f3ddbULL, 0x0fad, 35 },
    { 0xf79147999755ab6eULL, 0x0195, 30 },
    { 0xf9d00ca49969ca20ULL, 0x0c69, 40 },
    { 0xfbc828d4b775c13dULL, 0x0107, 45 },
    { 0xfc30f6b3c0a1a4adULL, 0x0052, 90 },
    { 0xfc99c0d1bcb65b97ULL, 0x0396, 35 }
};

static uint64_t swap_endian_64(uint64_t x) {
    return ((x & 0xFFULL) << 56) |
           ((x & 0xFF00ULL) << 40) |
           ((x & 0xFF0000ULL) << 24) |
           ((x & 0xFF000000ULL) << 8) |
           ((x & 0xFF00000000ULL) >> 8) |
           ((x & 0xFF0000000000ULL) >> 24) |
           ((x & 0xFF000000000000ULL) >> 40) |
           ((x & 0xFF00000000000000ULL) >> 56);
}

static uint16_t swap_endian_16(uint16_t x) {
    return static_cast<uint16_t>(((x & 0xFF) << 8) | ((x >> 8) & 0xFF));
}

static std::mt19937_64& get_book_rng() {
    static std::mt19937_64 rng([]() {
        std::random_device rd;
        uint64_t t = static_cast<uint64_t>(
            std::chrono::high_resolution_clock::now().time_since_epoch().count());
        return (static_cast<uint64_t>(rd()) << 32) ^ rd() ^ t;
    }());
    return rng;
}

Move probe_book(const Position& pos, const std::string& book_path, bool use_internal_fallback) {
    uint64_t poly_key = compute_polyglot_key(pos);
    std::vector<std::pair<Move, int>> candidates;

    // 1. Try external Polyglot .bin book (check book_path and ../book_path)
    std::ifstream file(book_path, std::ios::binary);
    if (!file.is_open()) {
        file.open("../" + book_path, std::ios::binary);
    }

    if (file.is_open()) {
        file.seekg(0, std::ios::end);
        std::streamoff file_size = file.tellg();
        if (file_size >= static_cast<std::streamoff>(sizeof(PolyglotEntry))) {
            size_t num_entries = static_cast<size_t>(file_size) / sizeof(PolyglotEntry);

            // Binary search for first matching key (bisect_left)
            size_t lo = 0;
            size_t hi = num_entries;
            while (lo < hi) {
                size_t mid = lo + (hi - lo) / 2;
                file.seekg(mid * sizeof(PolyglotEntry));
                PolyglotEntry entry;
                file.read(reinterpret_cast<char*>(&entry), sizeof(PolyglotEntry));
                uint64_t key = swap_endian_64(entry.key);
                if (key < poly_key) {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }

            size_t curr = lo;
            while (curr < num_entries) {
                file.seekg(curr * sizeof(PolyglotEntry));
                PolyglotEntry entry;
                file.read(reinterpret_cast<char*>(&entry), sizeof(PolyglotEntry));
                uint64_t key = swap_endian_64(entry.key);
                if (key != poly_key) break;

                uint16_t move_raw = swap_endian_16(entry.move);
                uint16_t weight = swap_endian_16(entry.weight);
                Move m = polyglot_move_to_engine(move_raw, pos);
                if (m != MOVE_NONE && weight > 0) {
                    candidates.push_back({ m, static_cast<int>(weight) });
                }
                curr++;
            }
        }
    }

    // 2. Fallback to built-in 344-entry Polyglot book if external book had no hits
    if (candidates.empty() && use_internal_fallback) {
        int lo = 0;
        int hi = BUILTIN_BOOK_SIZE;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (BUILTIN_POLYGLOT_BOOK[mid].key < poly_key) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        int curr = lo;
        while (curr < BUILTIN_BOOK_SIZE && BUILTIN_POLYGLOT_BOOK[curr].key == poly_key) {
            Move m = polyglot_move_to_engine(BUILTIN_POLYGLOT_BOOK[curr].raw_move, pos);
            int w = BUILTIN_POLYGLOT_BOOK[curr].weight;
            if (m != MOVE_NONE && w > 0) {
                candidates.push_back({ m, w });
            }
            curr++;
        }
    }

    if (!candidates.empty()) {
        int total_weight = 0;
        for (const auto& c : candidates) total_weight += c.second;

        std::uniform_int_distribution<int> dist(0, total_weight - 1);
        int r = dist(get_book_rng());
        int accum = 0;
        for (const auto& c : candidates) {
            accum += c.second;
            if (r < accum) return c.first;
        }
        return candidates[0].first;
    }

    return MOVE_NONE;
}

} // namespace Book
