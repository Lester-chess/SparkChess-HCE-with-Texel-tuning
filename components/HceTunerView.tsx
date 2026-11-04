import React, { useState } from 'react';
import {
  createDefaultHCEParams,
  HCEParams,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  PieceType,
  CENTER_MANHATTAN,
  computeTexelMse,
  runSpsaIteration,
  runTexelGradientStep,
} from '../engine/sparkchessHce';
import { Play, RotateCcw, Copy, Check } from 'lucide-react';

const PIECE_TABS: { type: PieceType; label: string }[] = [
  { type: PAWN, label: 'Pawn' },
  { type: KNIGHT, label: 'Knight' },
  { type: BISHOP, label: 'Bishop' },
  { type: ROOK, label: 'Rook' },
  { type: QUEEN, label: 'Queen' },
  { type: KING, label: 'King' },
];

interface TuningLogEntry {
  iter: number;
  mode: string;
  mse: number;
  pawnMg: number;
  knightMg: number;
  bishopPairEg: number;
  mopupWeight: number;
}

export const HceTunerView: React.FC = () => {
  const [params, setParams] = useState<HCEParams>(() => createDefaultHCEParams());
  const [activePiece, setActivePiece] = useState<PieceType>(KNIGHT);
  const [phaseTab, setPhaseTab] = useState<'mg' | 'eg' | 'mopup'>('mg');
  const [tuningMode, setTuningMode] = useState<'spsa' | 'texel'>('spsa');
  const [copied, setCopied] = useState(false);

  const [tuningLogs, setTuningLogs] = useState<TuningLogEntry[]>(() => [
    {
      iter: 0,
      mode: 'Baseline SF11',
      mse: computeTexelMse(createDefaultHCEParams()),
      pawnMg: 128,
      knightMg: 781,
      bishopPairEg: 52,
      mopupWeight: 18,
    },
  ]);

  const runOptimizationBatch = () => {
    let next = params;
    const startIter = tuningLogs.length;
    const newEntries: TuningLogEntry[] = [];

    for (let step = 0; step < 3; step++) {
      const iterNum = startIter + step;
      if (tuningMode === 'spsa') {
        const res = runSpsaIteration(next, iterNum);
        next = res.updated;
      } else {
        const res = runTexelGradientStep(next, 0.0025);
        next = res.updated;
      }
      const mse = computeTexelMse(next);
      newEntries.push({
        iter: iterNum,
        mode: tuningMode.toUpperCase(),
        mse,
        pawnMg: next.materialMg[PAWN] + 46,
        knightMg: next.materialMg[KNIGHT] + 444,
        bishopPairEg: next.bishopPairEg,
        mopupWeight: next.mopupCenterWeight,
      });
    }

    setParams(next);
    setTuningLogs((prev) => [...newEntries.reverse(), ...prev]);
  };

  const resetParams = () => {
    const def = createDefaultHCEParams();
    setParams(def);
    setTuningLogs([
      {
        iter: 0,
        mode: 'Baseline SF11',
        mse: computeTexelMse(def),
        pawnMg: 128,
        knightMg: 781,
        bishopPairEg: def.bishopPairEg,
        mopupWeight: def.mopupCenterWeight,
      },
    ]);
  };

  const exportCppStruct = () => {
    const code = `// Exported Stockfish 11 Tunable HCE Parameters (src/evaluate.h)
Eval::SF11TunableParams HCE_PARAMS = {
    0x53463131, // magic_header "SF11"
    ${params.materialMg[0] + 46}, ${params.materialEg[0] + 119},   // PawnValueMg, PawnValueEg
    ${params.materialMg[1] + 444}, ${params.materialEg[1] + 573},  // KnightValueMg, KnightValueEg
    ${params.materialMg[2] + 460}, ${params.materialEg[2] + 618},  // BishopValueMg, BishopValueEg
    ${params.materialMg[3] + 799}, ${params.materialEg[3] + 868},  // RookValueMg, RookValueEg
    ${params.materialMg[4] + 1513}, ${params.materialEg[4] + 1746}, // QueenValueMg, QueenValueEg
    100, // pawn_structure_scale_pct
    100, // imbalance_scale_pct
    100, // mobility_scale_pct
    100, // king_safety_scale_pct
    100, // threats_scale_pct
    100, // passed_pawns_scale_pct
    100, // space_scale_pct
    100, // initiative_scale_pct
    ${params.tempoBonus} // tempo_bonus
};`;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const currentMatrix =
    phaseTab === 'mopup'
      ? CENTER_MANHATTAN.map((d) => d * params.mopupCenterWeight)
      : phaseTab === 'mg'
      ? params.pstMg[activePiece]
      : params.pstEg[activePiece];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 6 Columns: Interactive PSQT (psqt.cpp) & Endgame King Push Heatmap */}
      <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Stockfish 11 PSQT (psqt.cpp) & Endgame Push Tables
            </h2>
            <p className="text-xs text-slate-400">
              Symmetric Bonus[PieceType][Rank][File/2] tables combined into Position::psq Score
            </p>
          </div>
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setPhaseTab('mg')}
              className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                phaseTab === 'mg' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Middlegame
            </button>
            <button
              type="button"
              onClick={() => setPhaseTab('eg')}
              className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                phaseTab === 'eg' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Endgame
            </button>
            <button
              type="button"
              onClick={() => setPhaseTab('mopup')}
              className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                phaseTab === 'mopup' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              PushToEdges (endgame.cpp)
            </button>
          </div>
        </div>

        {phaseTab !== 'mopup' && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {PIECE_TABS.map((pt) => (
              <button
                key={pt.type}
                type="button"
                onClick={() => setActivePiece(pt.type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  activePiece === pt.type
                    ? 'bg-slate-800 border-amber-500/60 text-amber-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        )}

        {/* 8x8 Heatmap */}
        <div className="grid grid-cols-8 gap-1 aspect-square max-w-[420px] mx-auto bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono tabular-nums">
          {Array.from({ length: 64 }).map((_, idx) => {
            const r = 7 - Math.floor(idx / 8);
            const f = idx % 8;
            const sq = (r << 3) | f;
            const val = currentMatrix[sq] ?? 0;

            let bgClass = 'bg-slate-900 text-slate-300';
            if (val >= 40) bgClass = 'bg-emerald-500/35 text-emerald-200 font-semibold border border-emerald-500/40';
            else if (val >= 15) bgClass = 'bg-emerald-500/15 text-emerald-300';
            else if (val <= -30) bgClass = 'bg-red-500/30 text-red-200';
            else if (val < 0) bgClass = 'bg-red-500/10 text-red-300';

            return (
              <div
                key={sq}
                className={`aspect-square flex flex-col items-center justify-center rounded ${bgClass}`}
              >
                <span className="text-[11px]">{val > 0 ? `+${val}` : val}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 6 Columns: Rewritten SF11 Trainer (trainer.cpp) & Pawn/Material Hash Architecture */}
      <div className="lg:col-span-6 flex flex-col gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Stockfish 11 Texel & SPSA Optimizer (trainer.cpp)
              </h3>
              <p className="text-xs text-slate-400">
                Tunes Eval::SF11TunableParams on Position + StateInfo and exports HCE1.bin
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runOptimizationBatch}
                className="px-3.5 py-1.5 text-xs font-medium bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Run {tuningMode.toUpperCase()} Step
              </button>
              <button
                type="button"
                onClick={resetParams}
                aria-label="Reset Tuned Parameters"
                className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800 rounded-lg border border-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setTuningMode('spsa')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                tuningMode === 'spsa'
                  ? 'bg-slate-800 border-amber-500/60 text-amber-400'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              SPSA Perturbation
            </button>
            <button
              type="button"
              onClick={() => setTuningMode('texel')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                tuningMode === 'texel'
                  ? 'bg-slate-800 border-amber-500/60 text-amber-400'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              Texel Sigmoid Regression
            </button>
            <button
              type="button"
              onClick={exportCppStruct}
              className="ml-auto px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 rounded-lg border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied SF11 Struct' : 'Copy SF11 Struct'}
            </button>
          </div>

          {/* Extended SF11 HCE Structural Dimension Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Quadratic Bishop Pair (material.cpp)</span>
                <span className="font-mono tabular-nums text-amber-400">
                  +{params.bishopPairMg} / +{params.bishopPairEg} cp
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                value={params.bishopPairEg}
                onChange={(e) => setParams({ ...params, bishopPairEg: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">RookOnFile Open/Semi (evaluate.cpp)</span>
                <span className="font-mono tabular-nums text-amber-400">
                  +{params.rookOpenFileMg} / +{params.rookOpenFileEg} cp
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={55}
                value={params.rookOpenFileMg}
                onChange={(e) => setParams({ ...params, rookOpenFileMg: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Isolated / Backward Penalty (pawns.cpp)</span>
                <span className="font-mono tabular-nums text-red-400">
                  -{params.isolatedPawnMg} / -{params.backwardPawnMg} cp
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                value={params.isolatedPawnMg}
                onChange={(e) => setParams({ ...params, isolatedPawnMg: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Endgame PushToEdges Weight (endgame.cpp)</span>
                <span className="font-mono tabular-nums text-emerald-400">{params.mopupCenterWeight} cp / step</span>
              </div>
              <input
                type="range"
                min={8}
                max={32}
                value={params.mopupCenterWeight}
                onChange={(e) => setParams({ ...params, mopupCenterWeight: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Optimization Log Table */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="text-xs font-medium text-slate-400 mb-2">Optimization Convergence History</div>
            <div className="overflow-x-auto max-h-[210px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-1.5 pr-3">Iter</th>
                    <th className="py-1.5 px-3">Texel MSE</th>
                    <th className="py-1.5 px-3">PawnValueMg</th>
                    <th className="py-1.5 px-3">KnightValueMg</th>
                    <th className="py-1.5 px-3">BishopPair</th>
                    <th className="py-1.5 pl-3 text-right">PushWeight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {tuningLogs.map((log) => (
                    <tr key={log.iter}>
                      <td className="py-1.5 pr-3 text-slate-400">#{log.iter}</td>
                      <td className="py-1.5 px-3 text-emerald-400">{log.mse.toFixed(5)}</td>
                      <td className="py-1.5 px-3">{log.pawnMg}</td>
                      <td className="py-1.5 px-3">{log.knightMg}</td>
                      <td className="py-1.5 px-3">{log.bishopPairEg}</td>
                      <td className="py-1.5 pl-3 text-right text-amber-400">{log.mopupWeight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
