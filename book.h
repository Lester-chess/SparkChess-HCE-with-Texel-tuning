#ifndef BOOK_H_INCLUDED
#define BOOK_H_INCLUDED

#include <string>
#include "types.h"
#include "position.h"

namespace Book {

void init_polyglot();
uint64_t compute_polyglot_key(const Position& pos);
Move probe_book(const Position& pos, const std::string& book_path, bool use_internal_fallback = true);

} // namespace Book

#endif // BOOK_H_INCLUDED
