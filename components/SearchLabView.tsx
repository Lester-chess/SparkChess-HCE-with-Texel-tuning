import React, { useState, useMemo } from 'react';
import {
  SearchConfig,
  MVV_LVA_MATRIX,
  computeLmrReduction,
  simulateSF11TimeManagement,
} from '../engine/sparkchessHce';

interface SearchLabViewProps {
  searchConfig: SearchConfig;
  onChangeConfig: (cfg: SearchConfig) => void;
}

const PIECE_NAMES = ['Pawn (P)', 'Knight (N)', 'Bishop (B)', 'Rook (R)', 'Queen (Q)', 'King (K)'];

export const SearchLabView: React.FC<SearchLabViewProps> = ({ searchConfig, onChangeConfig }) => {
  const [inspectNodeType, setInspectNodeType] = useState<'pv' | 'cut' | 'all'>('cut');
  const [inspectImproving, setInspectImproving] = useState<boolean>(false);

  // Stockfish 11 TimeManagement (timeman.cpp) interactive state
  const [remainingTimeMs, setRemainingTimeMs] = useState<number>(60000);
  const [incrementMs, setIncrementMs] = useState<number>(1000);
  const [movesToGo, setMovesToGo] = useState<number>(0);
  const [moveOverheadMs, setMoveOverheadMs] = useState<number>(10);
  const [slowMover, setSlowMover] = useState<number>(84);
  const [fallingEvalCp, setFallingEvalCp] = useState<number>(35);
  const [bestMoveChanges, setBestMoveChanges] = useState<number>(2);

  const timeSim = useMemo(
    () =>
      simulateSF11TimeManagement(
        remainingTimeMs,
        incrementMs,
        movesToGo,
        moveOverheadMs,
        slowMover,
        fallingEvalCp,
        bestMoveChanges
      ),
    [remainingTimeMs, incrementMs, movesToGo, moveOverheadMs, slowMover, fallingEvalCp, bestMoveChanges]
  );

  const updateField = (key: keyof SearchConfig, val: number) => {
    onChangeConfig({ ...searchConfig, [key]: val });
  };

  const depths = [3, 4, 5, 6, 7, 8, 10, 12];
  const moveIndices = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];

  return (
    <div className="space-y-6">
      {/* Top 2-Column Split: SF11 TimeManagement Simulator & LMR Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Columns: Stockfish 11 Dynamic Time Management (timeman.cpp) & Pruning */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Dynamic Time Management (timeman.cpp) & Search Pruning
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Stockfish 11 Optimum / Maximum time allocation modulated by fallingEval & bestMoveInstability
            </p>
          </div>

          {/* TimeManagement Live Output */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono tabular-nums text-xs">
            <div>
              <div className="text-slate-400 font-sans text-[11px]">Optimum Base</div>
              <div className="text-sm font-semibold text-slate-100 mt-0.5">{timeSim.optimumMs} ms</div>
            </div>
            <div>
              <div className="text-slate-400 font-sans text-[11px]">Dynamic Budget</div>
              <div className="text-sm font-semibold text-amber-400 mt-0.5">{timeSim.effectiveTurnBudgetMs} ms</div>
            </div>
            <div>
              <div className="text-slate-400 font-sans text-[11px]">Hard Maximum</div>
              <div className="text-sm font-semibold text-emerald-400 mt-0.5">{timeSim.maximumMs} ms</div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Remaining Clock (wtime / btime)</span>
                <span className="font-mono tabular-nums text-amber-400">{(remainingTimeMs / 1000).toFixed(0)} s</span>
              </div>
              <input
                type="range"
                min={5000}
                max={300000}
                step={5000}
                value={remainingTimeMs}
                onChange={(e) => setRemainingTimeMs(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Falling Eval Drop</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    -{fallingEvalCp} cp ({timeSim.fallingEvalMultiplier}x)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={150}
                  value={fallingEvalCp}
                  onChange={(e) => setFallingEvalCp(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">PV Instability Changes</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {bestMoveChanges}x ({timeSim.bestMoveInstabilityMultiplier}x)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  value={bestMoveChanges}
                  onChange={(e) => setBestMoveChanges(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Slow Mover (UCI)</span>
                  <span className="font-mono tabular-nums text-slate-200">{slowMover}%</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={200}
                  value={slowMover}
                  onChange={(e) => setSlowMover(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">RFP Margin (cp/d)</span>
                  <span className="font-mono tabular-nums text-slate-200">{searchConfig.rfpMargin} cp</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={160}
                  value={searchConfig.rfpMargin}
                  onChange={(e) => updateField('rfpMargin', Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">PV Node LMR Relief</span>
                  <span className="font-mono tabular-nums text-emerald-400">-{searchConfig.lmrPvBonus} ply</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  value={searchConfig.lmrPvBonus}
                  onChange={(e) => updateField('lmrPvBonus', Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Cut Node LMR Penalty</span>
                  <span className="font-mono tabular-nums text-red-400">+{searchConfig.lmrCutPenalty} ply</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  value={searchConfig.lmrCutPenalty}
                  onChange={(e) => updateField('lmrCutPenalty', Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 Columns: Interactive LMR Reduction Matrix */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Stockfish 11 Late Move Reductions (LMR) Table
              </h2>
              <p className="text-xs text-slate-400">
                Logarithmic base reduction adjusted by PVNode, cutNode, improving flag, and statScore
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['pv', 'cut', 'all'] as const).map((nt) => (
                  <button
                    key={nt}
                    type="button"
                    onClick={() => setInspectNodeType(nt)}
                    className={`px-2.5 py-1 rounded font-medium uppercase transition-colors cursor-pointer ${
                      inspectNodeType === nt
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {nt} Node
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setInspectImproving(!inspectImproving)}
                className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                  inspectImproving
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {inspectImproving ? 'Improving: TRUE' : 'Improving: FALSE'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 text-left font-sans">Depth \ Move #</th>
                  {moveIndices.map((mIdx) => (
                    <th key={mIdx} className="py-2 px-2">
                      #{mIdx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {depths.map((d) => (
                  <tr key={d}>
                    <td className="py-2 pr-3 text-left font-semibold text-slate-300">Depth {d}</td>
                    {moveIndices.map((mIdx) => {
                      const r = computeLmrReduction(
                        d,
                        mIdx,
                        inspectNodeType === 'pv',
                        inspectNodeType === 'cut',
                        inspectImproving,
                        0,
                        searchConfig
                      );
                      return (
                        <td
                          key={mIdx}
                          className={`py-2 px-2 rounded ${
                            r === 0
                              ? 'text-slate-500'
                              : r <= 2
                              ? 'text-amber-300 bg-amber-500/10'
                              : 'text-red-300 bg-red-500/15 font-semibold'
                          }`}
                        >
                          -{r}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Section: MVV-LVA + SEE & Lazy SMP Architecture */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-100">
            MovePicker Capture Scoring (MVV-LVA + CapturePieceToHistory + SEE) & Lazy SMP
          </h3>
          <p className="text-xs text-slate-400">
            In Stockfish 11 movepick.cpp, captures are scored by PieceValue[MG][captured] * 6 + captureHistory and filtered via pos.see_ge()
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 text-left font-sans">Victim \ Attacker</th>
                  {PIECE_NAMES.map((name) => (
                    <th key={name} className="py-2 px-2">
                      {name.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {MVV_LVA_MATRIX.slice(0, 5).map((row, victimIdx) => (
                  <tr key={PIECE_NAMES[victimIdx]}>
                    <td className="py-2 pr-3 text-left font-sans text-slate-300">
                      Capture {PIECE_NAMES[victimIdx]}
                    </td>
                    {row.map((score, attackerIdx) => (
                      <td
                        key={attackerIdx}
                        className={`py-2 px-2 ${
                          attackerIdx > victimIdx
                            ? 'text-amber-300 bg-amber-500/10'
                            : 'text-emerald-300 bg-emerald-500/10'
                        }`}
                      >
                        {score}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-5 space-y-3 text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-semibold text-slate-100">
              Stockfish 11 MovePicker & Lazy SMP Pipeline:
            </div>
            <p className="text-slate-400 leading-relaxed">
              1. <span className="text-amber-300">Stage 1 (MAIN_TT)</span>: Probes Transposition Table move immediately without generating any moves. If a Beta cutoff occurs, 100% of movegen is skipped.
            </p>
            <p className="text-slate-400 leading-relaxed">
              2. <span className="text-emerald-400">Stage 2 (GOOD_CAPTURE)</span>: Uses <span className="font-mono">pos.see_ge(m, -55 * score / 1024)</span> to separate winning/equal captures from losing captures (<span className="font-mono">BAD_CAPTURE</span>).
            </p>
            <p className="text-slate-400 leading-relaxed">
              3. <span className="text-slate-200">Lazy SMP ThreadPool (thread.cpp)</span>: Worker threads share lockless 3-entry TT clusters while maintaining thread-local <span className="font-mono">Pawns::Table</span>, <span className="font-mono">Material::Table</span>, and <span className="font-mono">ContinuationHistory</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
