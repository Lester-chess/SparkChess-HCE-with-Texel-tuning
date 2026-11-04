import React, { useState, useMemo } from 'react';
import {
  SparkBoard,
  WHITE,
  BLACK,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  squareToAlgebraic,
  searchPosition,
  SearchConfig,
  MoveObj,
  analyzeSF11Subsystems,
  analyzeMovePickerStages,
} from '../engine/sparkchessHce';
import { Play, RotateCcw } from 'lucide-react';

interface PresetPosition {
  name: string;
  subtitle: string;
  fen: string;
}

const PRESET_POSITIONS: PresetPosition[] = [
  {
    name: 'Kiwipete Tactical Benchmark',
    subtitle: 'MovePicker GOOD_CAPTURE (SEE >= 0) vs BAD_CAPTURE stage separation & King Shelter',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  },
  {
    name: 'KPK Bitbase Exact Lookup (bitbase.cpp)',
    subtitle: '24KB compressed KPK bitbase instant Win/Draw probe without search tree explosion',
    fen: '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1',
  },
  {
    name: 'KBNK Specialized Endgame (endgame.cpp)',
    subtitle: 'Endgame<KBNK> drives lone King toward matching bishop-color corner',
    fen: '7k/8/5KN1/8/8/3B4/8/8 w - - 0 1',
  },
  {
    name: 'Opposite-Colored Bishops Fortress (ScaleFactor)',
    subtitle: 'Material::Entry & Evaluation::scale_factor() scales down OCB blockade',
    fen: '8/8/3k1b2/3P4/3K1B2/8/8/8 w - - 0 1',
  },
  {
    name: 'KRKP Tempo & King Distance (endgame.cpp)',
    subtitle: 'Endgame<KRKP> evaluates active King shield vs far advanced enemy passed pawn',
    fen: '8/8/8/8/2k5/2p5/R7/2K5 w - - 0 1',
  },
  {
    name: 'Decoy Pawn Sacrifice Breakthrough',
    subtitle: 'White sacrifices c7-c8Q to eliminate defender & win with extra piece',
    fen: '5k2/1bP5/2N5/2K5/8/2B5/8/8 w - - 0 1',
  },
  {
    name: 'Standard Opening Position (Polyglot Book)',
    subtitle: 'Balanced 128-phase SF11 incremental PSQT + Tempo + Polyglot key',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  },
];

const PIECE_UNICODE: Record<number, Record<number, string>> = {
  [WHITE]: {
    [PAWN]: '♙',
    [KNIGHT]: '♘',
    [BISHOP]: '♗',
    [ROOK]: '♖',
    [QUEEN]: '♕',
    [KING]: '♔',
  },
  [BLACK]: {
    [PAWN]: '♟',
    [KNIGHT]: '♞',
    [BISHOP]: '♝',
    [ROOK]: '♜',
    [QUEEN]: '♛',
    [KING]: '♚',
  },
};

interface ArenaViewProps {
  searchConfig: SearchConfig;
}

export const ArenaView: React.FC<ArenaViewProps> = ({ searchConfig }) => {
  const [fen, setFen] = useState<string>(PRESET_POSITIONS[0].fen);
  const [fenInput, setFenInput] = useState<string>(PRESET_POSITIONS[0].fen);
  const [selectedSq, setSelectedSq] = useState<number | null>(null);
  const [searchDepth, setSearchDepth] = useState<number>(4);
  const [lazySmpThreads, setLazySmpThreads] = useState<number>(4);
  const [autoReply, setAutoReply] = useState<boolean>(true);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [fenError, setFenError] = useState<string>('');

  const board = useMemo(() => new SparkBoard(fen), [fen]);
  const legalMoves = useMemo(() => board.generateLegalMoves(), [board]);
  const evalDetails = useMemo(() => board.evaluateDetailed(), [board]);
  const sf11Info = useMemo(() => analyzeSF11Subsystems(board), [board]);
  const telemetry = useMemo(
    () => searchPosition(board, searchDepth, searchConfig),
    [board, searchDepth, searchConfig]
  );
  const movePickerStages = useMemo(
    () => analyzeMovePickerStages(board, telemetry.orderedRootMoves, telemetry.bestMove?.uci || null),
    [board, telemetry]
  );

  const selectedLegalMoves = useMemo(() => {
    if (selectedSq === null) return [];
    return legalMoves.filter((m) => m.from === selectedSq);
  }, [legalMoves, selectedSq]);

  const handleSquareClick = (sq: number) => {
    if (selectedSq !== null) {
      const move = selectedLegalMoves.find((m) => m.to === sq);
      if (move) {
        executeMove(move);
        setSelectedSq(null);
        return;
      }
    }
    const piece = board.squares[sq];
    if (piece && piece.color === board.turn) {
      setSelectedSq(sq);
    } else {
      setSelectedSq(null);
    }
  };

  const executeMove = (move: MoveObj) => {
    const next = board.clone();
    if (next.makeMove(move)) {
      const nextFen = next.toFen();
      setFen(nextFen);
      setFenInput(nextFen);
      setMoveHistory((prev) => [...prev, move.uci]);

      if (autoReply) {
        setTimeout(() => {
          const replyBoard = new SparkBoard(nextFen);
          const replySearch = searchPosition(replyBoard, Math.min(4, searchDepth), searchConfig);
          if (replySearch.bestMove) {
            replyBoard.makeMove(replySearch.bestMove);
            const afterReplyFen = replyBoard.toFen();
            setFen(afterReplyFen);
            setFenInput(afterReplyFen);
            setMoveHistory((prev) => [...prev, replySearch.bestMove!.uci]);
          }
        }, 180);
      }
    }
  };

  const handleEnginePlayBest = () => {
    if (telemetry.bestMove) {
      const next = board.clone();
      next.makeMove(telemetry.bestMove);
      const nextFen = next.toFen();
      setFen(nextFen);
      setFenInput(nextFen);
      setMoveHistory((prev) => [...prev, telemetry.bestMove!.uci]);
      setSelectedSq(null);
    }
  };

  const handleApplyFen = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fenInput.trim();
    if (!trimmed || trimmed.split(/\s+/).length < 2) {
      setFenError('Invalid FEN string: must include piece placement and active side (w/b).');
      return;
    }
    const testB = new SparkBoard();
    if (!testB.loadFen(trimmed)) {
      setFenError('Failed to parse FEN board placement.');
      return;
    }
    setFenError('');
    setFen(trimmed);
    setSelectedSq(null);
    setMoveHistory([]);
  };

  const loadPreset = (preset: PresetPosition) => {
    setFen(preset.fen);
    setFenInput(preset.fen);
    setFenError('');
    setSelectedSq(null);
    setMoveHistory([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 5 Columns: Interactive Position::StateInfo Board & Preset Suite */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Position & StateInfo Workbench</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                {board.turn === WHITE ? 'White to move' : 'Black to move'} · Phase {sf11Info.gamePhase128}/128 · Scale {sf11Info.scaleFactor64}/64
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEnginePlayBest}
                disabled={!telemetry.bestMove}
                className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5" />
                Play Best ({telemetry.bestMove?.uci || 'none'})
              </button>
              <button
                type="button"
                onClick={() => loadPreset(PRESET_POSITIONS[0])}
                aria-label="Reset Board"
                className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 8x8 Chessboard */}
          <div
            data-testid="chessboard-grid"
            className="grid grid-cols-8 aspect-square w-full max-w-[420px] mx-auto border border-slate-700 rounded-lg overflow-hidden select-none"
          >
            {Array.from({ length: 64 }).map((_, idx) => {
              const r = 7 - Math.floor(idx / 8);
              const f = idx % 8;
              const sq = (r << 3) | f;
              const isLight = (r + f) % 2 === 1;
              const piece = board.squares[sq];
              const isSelected = selectedSq === sq;
              const targetMove = selectedLegalMoves.find((m) => m.to === sq);
              const isBestFrom = telemetry.bestMove?.from === sq;
              const isBestTo = telemetry.bestMove?.to === sq;

              return (
                <button
                  key={sq}
                  type="button"
                  onClick={() => handleSquareClick(sq)}
                  aria-label={`Square ${squareToAlgebraic(sq)}${piece ? ` with ${piece.color === WHITE ? 'White' : 'Black'} piece` : ''}`}
                  className={`relative flex items-center justify-center text-3xl sm:text-4xl transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/50'
                      : targetMove
                      ? 'bg-emerald-500/35'
                      : isBestFrom || isBestTo
                      ? isLight
                        ? 'bg-amber-200/80 text-slate-900'
                        : 'bg-amber-600/60 text-slate-100'
                      : isLight
                      ? 'bg-slate-200 text-slate-900'
                      : 'bg-slate-600 text-slate-100'
                  }`}
                >
                  {f === 0 && (
                    <span
                      className={`absolute top-0.5 left-1 text-[10px] font-mono leading-none ${
                        isLight ? 'text-slate-600' : 'text-slate-300'
                      }`}
                    >
                      {r + 1}
                    </span>
                  )}
                  {r === 0 && (
                    <span
                      className={`absolute bottom-0.5 right-1 text-[10px] font-mono leading-none ${
                        isLight ? 'text-slate-600' : 'text-slate-300'
                      }`}
                    >
                      {String.fromCharCode(97 + f)}
                    </span>
                  )}
                  {targetMove && !piece && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 pointer-events-none" />
                  )}
                  {piece && (
                    <span className={piece.color === WHITE ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]' : ''}>
                      {PIECE_UNICODE[piece.color][piece.type]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Depth, Lazy SMP Threads & Auto-Reply Controls */}
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-3 items-center text-xs">
            <div className="flex items-center gap-2">
              <label htmlFor="depth-select" className="text-slate-400">
                Depth:
              </label>
              <select
                id="depth-select"
                value={searchDepth}
                onChange={(e) => setSearchDepth(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 font-mono"
              >
                <option value={3}>3 ply</option>
                <option value={4}>4 ply</option>
                <option value={5}>5 ply</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="smp-select" className="text-slate-400">
                Threads:
              </label>
              <select
                id="smp-select"
                value={lazySmpThreads}
                onChange={(e) => setLazySmpThreads(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 font-mono"
              >
                <option value={1}>1 (Main)</option>
                <option value={4}>4 (Lazy SMP)</option>
                <option value={8}>8 (Lazy SMP)</option>
                <option value={16}>16 (Lazy SMP)</option>
              </select>
            </div>
            <label className="flex items-center justify-end gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoReply}
                onChange={(e) => setAutoReply(e.target.checked)}
                className="rounded border-slate-700 accent-amber-500"
              />
              Auto-Reply
            </label>
          </div>

          {/* FEN Loader */}
          <form onSubmit={handleApplyFen} className="mt-3 flex gap-2">
            <input
              type="text"
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              placeholder="Paste FEN position..."
              aria-label="FEN string input"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Load FEN
            </button>
          </form>
          {fenError && <p className="mt-1.5 text-xs text-red-400">{fenError}</p>}
          {moveHistory.length > 0 && (
            <div className="mt-2 text-xs text-slate-400 font-mono truncate">
              StateList History: {moveHistory.join(' ')}
            </div>
          )}
        </div>

        {/* SF11 Diagnostic Test Suite */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Stockfish 11 Subsystem Test Positions
          </h3>
          <div className="space-y-2">
            {PRESET_POSITIONS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => loadPreset(preset)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  fen === preset.fen
                    ? 'bg-slate-800/90 border-amber-500/60 text-slate-100'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-medium text-slate-100">{preset.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{preset.subtitle}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right 7 Columns: Stockfish 11 Evaluation Trace, Hash Caches & Staged MovePicker */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        {/* Top Summary Strip */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Stockfish 11 Evaluation & Pawn/Material Hash Telemetry
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                PawnKey {sf11Info.pawnHashKeyHex} (Idx #{sf11Info.pawnTableIndex}) · MaterialKey {sf11Info.materialHashKeyHex} (Idx #{sf11Info.materialTableIndex})
              </p>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-2xl font-bold text-amber-400">
                {evalDetails.whitePovScore > 0 ? `+${evalDetails.whitePovScore}` : evalDetails.whitePovScore} cp
              </div>
              <div className="text-[11px] text-slate-400">
                White POV · PV Best: {telemetry.bestMove?.uci || 'none'} ({telemetry.scoreCp > 0 ? `+${telemetry.scoreCp}` : telemetry.scoreCp} cp)
              </div>
            </div>
          </div>

          {/* Endgame / Bitbase & Hash Table Status Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 border-b border-slate-800 text-xs">
            <div>
              <div className="text-slate-400">Endgames & Bitbase Module</div>
              <div className="font-mono text-slate-200 mt-0.5">{sf11Info.specializedEndgameName}</div>
            </div>
            <div>
              <div className="text-slate-400">KPK Bitbase (bitbase.cpp)</div>
              <div className="font-mono text-emerald-400 mt-0.5">
                {sf11Info.kpkBitbaseResult} · Scale {sf11Info.scaleFactor64}/64
              </div>
            </div>
            <div>
              <div className="text-slate-400">Passed Pawns (Pawns::Entry)</div>
              <div className="font-mono text-amber-300 mt-0.5">
                W: [{sf11Info.passedPawnsSquares[0].join(', ') || 'none'}] · B: [{sf11Info.passedPawnsSquares[1].join(', ') || 'none'}]
              </div>
            </div>
          </div>

          {/* Stockfish 11 Eval::trace() Term Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium font-sans">SF11 Eval::trace Term</th>
                  <th className="py-2 px-3 text-right">White MG</th>
                  <th className="py-2 px-3 text-right">Black MG</th>
                  <th className="py-2 px-3 text-right">White EG</th>
                  <th className="py-2 px-3 text-right">Black EG</th>
                  <th className="py-2 pl-3 text-right">Net Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                <tr>
                  <td className="py-2 pr-3 font-sans text-slate-300">Material + PSQT (Position::psq)</td>
                  <td className="py-2 px-3 text-right">{evalDetails.incrementalMg[0]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.incrementalMg[1]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.incrementalEg[0]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.incrementalEg[1]}</td>
                  <td className="py-2 pl-3 text-right text-amber-400">
                    {evalDetails.incrementalMg[0] - evalDetails.incrementalMg[1]} /{' '}
                    {evalDetails.incrementalEg[0] - evalDetails.incrementalEg[1]}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-sans text-slate-300">Quadratic Imbalance (Material::Table)</td>
                  <td className="py-2 px-3 text-right">{sf11Info.imbalanceMg[0]}</td>
                  <td className="py-2 px-3 text-right">{sf11Info.imbalanceMg[1]}</td>
                  <td className="py-2 px-3 text-right">{sf11Info.imbalanceEg[0]}</td>
                  <td className="py-2 px-3 text-right">{sf11Info.imbalanceEg[1]}</td>
                  <td className="py-2 pl-3 text-right text-amber-400">
                    {sf11Info.imbalanceMg[0] - sf11Info.imbalanceMg[1]} /{' '}
                    {sf11Info.imbalanceEg[0] - sf11Info.imbalanceEg[1]}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-sans text-slate-300">Pawns & Passed (Pawns::Table)</td>
                  <td className="py-2 px-3 text-right">{evalDetails.pawnStructureMg[0]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.pawnStructureMg[1]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.pawnStructureEg[0]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.pawnStructureEg[1]}</td>
                  <td className="py-2 pl-3 text-right text-amber-400">
                    {evalDetails.pawnStructureMg[0] - evalDetails.pawnStructureMg[1]} /{' '}
                    {evalDetails.pawnStructureEg[0] - evalDetails.pawnStructureEg[1]}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-sans text-slate-300">Pieces & Mobility (Evaluation::pieces)</td>
                  <td className="py-2 px-3 text-right">{evalDetails.mobilityMg[0]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.mobilityMg[1]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.mobilityEg[0]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.mobilityEg[1]}</td>
                  <td className="py-2 pl-3 text-right text-amber-400">
                    {evalDetails.mobilityMg[0] - evalDetails.mobilityMg[1]} /{' '}
                    {evalDetails.mobilityEg[0] - evalDetails.mobilityEg[1]}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-sans text-slate-300">King Safety Shelter & Storm (Pawns::shelter)</td>
                  <td className="py-2 px-3 text-right">{evalDetails.kingSafetyMg[0]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.kingSafetyMg[1]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.kingSafetyEg[0]}</td>
                  <td className="py-2 px-3 text-right">{evalDetails.kingSafetyEg[1]}</td>
                  <td className="py-2 pl-3 text-right text-amber-400">
                    {evalDetails.kingSafetyMg[0] - evalDetails.kingSafetyMg[1]} / 0
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-sans text-slate-300">Space & Initiative Complexity (SF11)</td>
                  <td className="py-2 px-3 text-right">{sf11Info.spaceMg[0]}</td>
                  <td className="py-2 px-3 text-right">{sf11Info.spaceMg[1]}</td>
                  <td className="py-2 px-3 text-right" colSpan={2}>
                    Initiative: {sf11Info.initiativeMg} / {sf11Info.initiativeEg} cp
                  </td>
                  <td className="py-2 pl-3 text-right text-emerald-400">
                    {evalDetails.mopupEg !== 0 ? `MopUp ${evalDetails.mopupEg}` : `Init ${sf11Info.initiativeEg}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Staged MovePicker (movepick.cpp) Live Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Staged MovePicker Pipeline (movepick.cpp + Position::see_ge)
              </h3>
              <p className="text-xs text-slate-400 font-mono tabular-nums">
                Nodes {telemetry.nodes * lazySmpThreads} ({lazySmpThreads} Thread{lazySmpThreads > 1 ? 's' : ''}) · NPS {(telemetry.nps * lazySmpThreads).toLocaleString()} · First-Move Beta Cutoff {telemetry.fhfPercent}%
              </p>
            </div>
            <div className="text-xs font-mono text-slate-300">
              PV: <span className="text-amber-400">{telemetry.pv.join(' ') || 'none'}</span>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {movePickerStages.map((st) => (
              <div key={st.stageCode} className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{st.stageName}</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {st.movesCount} move{st.movesCount === 1 ? '' : 's'}
                    {st.movesList.length > 0 && ` (${st.movesList.slice(0, 5).map((m) => m.uci).join(', ')})`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{st.description}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-1.5 pr-3">#</th>
                  <th className="py-1.5 px-3">Move</th>
                  <th className="py-1.5 px-3">MovePicker Stage & Heuristic</th>
                  <th className="py-1.5 px-3 text-right">MVV-LVA</th>
                  <th className="py-1.5 px-3 text-right">SEE (cp)</th>
                  <th className="py-1.5 pl-3 text-right">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {telemetry.orderedRootMoves.slice(0, 12).map((m, idx) => (
                  <tr
                    key={m.uci}
                    onClick={() => executeMove(m)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-1.5 pr-3 text-slate-500">{idx + 1}</td>
                    <td className="py-1.5 px-3 font-semibold text-amber-400">{m.uci}</td>
                    <td className="py-1.5 px-3 font-sans text-slate-300">{m.orderReason}</td>
                    <td className="py-1.5 px-3 text-right">{m.mvvLva !== undefined ? m.mvvLva : '—'}</td>
                    <td
                      className={`py-1.5 px-3 text-right ${
                        m.seeScore !== undefined
                          ? m.seeScore >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {m.seeScore !== undefined ? (m.seeScore >= 0 ? `+${m.seeScore}` : m.seeScore) : '—'}
                    </td>
                    <td className="py-1.5 pl-3 text-right text-slate-300">{m.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
