import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, Search, ExternalLink } from 'lucide-react';

interface SourceFileEntry {
  name: string;
  path: string;
  category: string;
  content: string;
  lines: number;
}

const SF11_ARCHITECTURE_DIFFS = [
  {
    module: 'Position & StateInfo (position.cpp/.h, psqt.cpp, types.h)',
    before: 'board.cpp/.h + zobrist.cpp/.h with simple UndoState array',
    after: 'Linked StateInfo stack maintaining incremental Score psq, pawnKey, materialKey, nonPawnMaterial, blockersForKing, pinners, and SEE (see_ge)',
  },
  {
    module: 'Pawn Hash Table & Shelter (pawns.cpp/.h)',
    before: 'Recomputed basic isolated/doubled pawns inside evaluate.cpp on every node',
    after: '16,384-entry thread-local Pawns::Table caching Backward, Doubled, Isolated, Connected, Phalanx, Passed Pawns, and King Shelter/Storm',
  },
  {
    module: 'Material Imbalance & Hash Table (material.cpp/.h)',
    before: 'Linear piece counts + simple bishop pair bonus',
    after: '8,192-entry Material::Table computing SF11 2nd-degree polynomial QuadraticOurs/Theirs imbalance, caching gamePhase (0..128) & Endgame pointers',
  },
  {
    module: 'Specialized Endgames & KPK Bitbase (endgame.cpp/.h, bitbase.cpp)',
    before: 'Generic mop-up evaluation only',
    after: '24KB exact KPK Bitbase lookup + specialized KXK, KBNK, KRKP, KRKB, KRKN, KQKP, KQKR evaluators and OCB/KRPKR ScaleFactor functions + Syzygy tbprobe',
  },
  {
    module: 'Staged MovePicker (movepick.cpp/.h)',
    before: 'Generated all moves at once and ran std::sort in search.cpp',
    after: 'On-demand state machine: MAIN_TT -> GOOD_CAPTURE (SEE >= 0) -> REFUTATION (Killers + Countermove) -> QUIET (Butterfly + Continuation History) -> BAD_CAPTURE',
  },
  {
    module: 'Lazy SMP & Dynamic TimeMan (thread.cpp/.h, timeman.cpp/.h)',
    before: 'Basic std::thread loop & fixed time division in search.cpp',
    after: 'Full SF11 ThreadPool with vote-based get_best_thread() selection and TimeManagement modulated by fallingEval, bestMoveInstability, and Slow Mover',
  },
];

export const SourceInspectorView: React.FC = () => {
  const [files, setFiles] = useState<SourceFileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<SourceFileEntry | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'sf11' | 'header' | 'source' | 'build'>('all');
  const [copied, setCopied] = useState(false);

  // Search Grounding state
  const [researchQuery, setResearchQuery] = useState(
    'Stockfish 11 MovePicker staged generation SEE threshold and Pawns::Table king shelter storm evaluation'
  );
  const [researchResult, setResearchResult] = useState<string>('');
  const [researchSources, setResearchSources] = useState<{ title: string; uri: string }[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState('');

  useEffect(() => {
    fetch('/api/source-files')
      .then((r) => r.json())
      .then((data) => {
        if (data.files && data.files.length > 0) {
          setFiles(data.files);
          const pawnsCpp = data.files.find((f: SourceFileEntry) => f.name === 'pawns.cpp');
          setSelectedFile(pawnsCpp || data.files[0]);
        }
      })
      .catch(() => {});
  }, []);

  const sf11NewNames = new Set([
    'pawns.cpp', 'pawns.h',
    'material.cpp', 'material.h',
    'endgame.cpp', 'endgame.h',
    'bitbase.cpp',
    'movepick.cpp', 'movepick.h',
    'thread.cpp', 'thread.h', 'thread_win32_osx.h',
    'timeman.cpp', 'timeman.h',
    'position.cpp', 'position.h',
    'psqt.cpp', 'ucioption.cpp', 'benchmark.cpp',
    'tbprobe.cpp', 'tbprobe.h',
  ]);

  const filteredFiles = files.filter((f) => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'sf11') return sf11NewNames.has(f.name);
    return f.category === categoryFilter;
  });

  const handleCopyCode = () => {
    if (!selectedFile) return;
    navigator.clipboard?.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRunResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchQuery.trim()) return;
    setResearchLoading(true);
    setResearchError('');
    try {
      const resp = await fetch('/api/chess-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: researchQuery }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setResearchError(data.error || 'Search grounding request failed.');
      } else {
        setResearchResult(data.text || '');
        setResearchSources(data.sources || []);
      }
    } catch (err: any) {
      setResearchError(err.message || 'Network error while querying Search Grounding.');
    } finally {
      setResearchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Architecture Upgrade Matrix: SparkChess 1.4.1 -> Stockfish 11 HCE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              SparkChess 1.4.1 to Stockfish 11 HCE Module Upgrade Matrix
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              All 7 missing Stockfish 11 subsystems integrated alongside rewritten Polyglot Book (book.cpp) and Texel/SPSA Tuner (trainer.cpp)
            </p>
          </div>
          <a
            href="/api/download-zip"
            download="sparkchess_v15_sf11_hce.zip"
            className="px-3.5 py-2 text-xs font-medium bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download Full C++17 Project ZIP
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-4 font-medium">Subsystem & Source Files</th>
                <th className="py-2 px-4 font-medium">Original SparkChess 1.4.1</th>
                <th className="py-2 pl-4 font-medium">Upgraded SparkChess v15 (Stockfish 11 Architecture)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {SF11_ARCHITECTURE_DIFFS.map((item) => (
                <tr key={item.module}>
                  <td className="py-2.5 pr-4 font-mono text-amber-400 whitespace-nowrap">{item.module}</td>
                  <td className="py-2.5 px-4 text-slate-400">{item.before}</td>
                  <td className="py-2.5 pl-4 text-slate-200">{item.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* C++17 Refactored Source Code Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-100 font-mono tabular-nums">
              Project Files ({files.length})
            </h2>
          </div>

          <div className="grid grid-cols-5 gap-1 p-1 mb-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px]">
            {(
              [
                ['all', 'All'],
                ['sf11', 'SF11'],
                ['header', '.h'],
                ['source', '.cpp'],
                ['build', 'Build'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(key)}
                className={`py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  categoryFilter === key
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-1 max-h-[680px] overflow-y-auto">
            {filteredFiles.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setSelectedFile(f)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                  selectedFile?.path === f.path
                    ? 'bg-slate-800 text-amber-400 border border-amber-500/40'
                    : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <span className="truncate">{f.path}</span>
                <span className="text-[10px] text-slate-500 tabular-nums ml-2 shrink-0">{f.lines}L</span>
              </button>
            ))}
          </div>
        </div>

        {/* Code Viewer */}
        <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-xl p-5">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold font-mono text-amber-400">{selectedFile.path}</h3>
                  <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                    {selectedFile.lines} lines · Category: {selectedFile.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 rounded-lg border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied File' : 'Copy Source'}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[650px] overflow-y-auto leading-relaxed">
                <code>{selectedFile.content}</code>
              </pre>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-12 text-center">Select a source file to inspect</div>
          )}
        </div>
      </div>

      {/* Chess Programming & Stockfish 11 Research Assistant */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-slate-100 mb-1">
          Stockfish 11 HCE & Search Architecture Research Assistant
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Query specific Stockfish 11 formulas (e.g. Quadratic Imbalance, MovePicker SEE margins, or Lazy SMP thread voting)
        </p>

        <form onSubmit={handleRunResearch} className="flex gap-2">
          <input
            type="text"
            value={researchQuery}
            onChange={(e) => setResearchQuery(e.target.value)}
            placeholder="Ask about Stockfish 11 HCE or Alpha-Beta search internals..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={researchLoading}
            className="px-4 py-2 text-xs font-medium bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" />
            {researchLoading ? 'Querying...' : 'Search Grounding'}
          </button>
        </form>

        {researchError && <p className="mt-3 text-xs text-red-400">{researchError}</p>}
        {researchResult && (
          <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
            {researchResult}
            {researchSources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-3">
                {researchSources.map((s, idx) => (
                  <a
                    key={idx}
                    href={s.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {s.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
