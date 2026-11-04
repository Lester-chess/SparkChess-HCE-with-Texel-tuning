import React, { useState } from 'react';
import { DEFAULT_SEARCH_CONFIG, SearchConfig } from './engine/sparkchessHce';
import { ArenaView } from './components/ArenaView';
import { SearchLabView } from './components/SearchLabView';
import { HceTunerView } from './components/HceTunerView';
import { SourceInspectorView } from './components/SourceInspectorView';

type TabId = 'arena' | 'search-lab' | 'hce-tuner' | 'cpp-source';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('arena');
  const [searchConfig, setSearchConfig] = useState<SearchConfig>(DEFAULT_SEARCH_CONFIG);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-30 backdrop-blur">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#arena"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('arena');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          SparkChess v15 SF11-HCE
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('arena')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'arena'
                ? 'text-amber-400 border-amber-400 font-semibold'
                : 'border-transparent hover:text-slate-100 hover:border-slate-700'
            }`}
          >
            Position & Arena
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('search-lab')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'search-lab'
                ? 'text-amber-400 border-amber-400 font-semibold'
                : 'border-transparent hover:text-slate-100 hover:border-slate-700'
            }`}
          >
            TimeMan & MovePicker
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hce-tuner')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'hce-tuner'
                ? 'text-amber-400 border-amber-400 font-semibold'
                : 'border-transparent hover:text-slate-100 hover:border-slate-700'
            }`}
          >
            PSQT & SF11 Tuner
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cpp-source')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'cpp-source'
                ? 'text-amber-400 border-amber-400 font-semibold'
                : 'border-transparent hover:text-slate-100 hover:border-slate-700'
            }`}
          >
            C++17 Source (42 Files)
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/api/download-zip"
            download="sparkchess_v15_sf11_hce.zip"
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Download SF11-HCE ZIP
          </a>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        <div className="mb-6 pb-4 border-b border-slate-800/80 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Stockfish 11 Hand-Crafted Evaluation & Lazy SMP Architecture Upgrade
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Position & StateInfo · Pawns::Table (16K) · Material::Table (8K) · Staged MovePicker + SEE · Endgames & 24KB KPK Bitbase · Lazy SMP ThreadPool · TimeManagement
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            22 C++ Sources · 20 Headers · 3 Build Scripts
          </div>
        </div>

        {activeTab === 'arena' && <ArenaView searchConfig={searchConfig} />}
        {activeTab === 'search-lab' && (
          <SearchLabView searchConfig={searchConfig} onChangeConfig={setSearchConfig} />
        )}
        {activeTab === 'hce-tuner' && <HceTunerView />}
        {activeTab === 'cpp-source' && <SourceInspectorView />}
      </main>
    </div>
  );
}
