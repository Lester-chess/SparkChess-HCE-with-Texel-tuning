# SparkChess 3.0 Manuel


<div align="center">
  <img src="./86245edf-5bf5-404a-a5c6-a809089cd31f.jpg" alt="SparkChess Logo" width="160" style="border-radius: 20%;">
  <h1>SparkChess 3.0.20261106</h1>
  <p>A lite chess engine with NNUE</p>
  <p>Supported:Android OEX /Windows</p>
  <!-- Windows 平台徽章 -->

  [![Platform - Windows](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white)](https://github.com/USERNAME/REPO/releases)

<!-- Android 平台徽章 -->
[![Platform - Android](https://img.shields.io/badge/platform-Android-34A853?logo=android&logoColor=white)](https://github.com/USERNAME/REPO/releases)
</div>

<!-- 最新 Release 版本 -->
![release](https://img.shields.io/github/v/release/Lester-chess/Sparkchess-HCE-with-Texel-tuning?label=release)

<!-- 开源协议 License -->
![license](https://img.shields.io/github/license/Lester-chess/Sparkchess-HCE-with-Texel-tuning)
<!-- Lichess Classical -->
![Lichess Classical](https://img.shields.io/badge/dynamic/json?color=0080ff&label=Lichess%20Classical&logo=lichess&query=%24.perfs.classical.rating&url=https%3A%2F%2Flichess.org%2Fapi%2Fuser%2FSparkchessengine)

<!-- Lichess Rapid -->
![Lichess Rapid](https://img.shields.io/badge/dynamic/json?color=0080ff&label=Lichess%20Rapid&logo=lichess&query=%24.perfs.rapid.rating&url=https%3A%2F%2Flichess.org%2Fapi%2Fuser%2FSparkchessengine)

<!-- Lichess Blitz -->
![Lichess Blitz](https://img.shields.io/badge/dynamic/json?color=0080ff&label=Lichess%20Blitz&logo=lichess&query=%24.perfs.blitz.rating&url=https%3A%2F%2Flichess.org%2Fapi%2Fuser%2FSparkchessengine)

<!-- Lichess Bullet -->
![Lichess Bullet](https://img.shields.io/badge/dynamic/json?color=0080ff&label=Lichess%20Bullet&logo=lichess&query=%24.perfs.bullet.rating&url=https%3A%2F%2Flichess.org%2Fapi%2Fuser%2FSparkchessengine)


SparkChess is a high-performance chess engine compliant with the Universal Chess Interface (UCI) protocol, featuring lite HalfkAv2 NNUE eval.


---

## 1. System Requirements & Installation

### 1.1 Requirements
- **Linux** (Ubuntu 20.04+ recommended) or **Windows** (10/11 x86_64)
- **Compiler**: GCC / G++ (v9.0+ supporting C++17) or MSVC
- **Dependencies**: OpenMP (for multi-threaded tuning)
- **Compatibility Layer (Optional)**: Wine (required only if running Windows `.exe` on Linux instances)

### 1.2 Compilation from Source

#### On Linux (Native / AutoDL / VPS)
```bash
# Clone the repository
git clone https://github.com/your-repo/sparkchess.git
cd sparkchess

# Build using G++ with optimization flags
g++ -O3 -std=c++17 -fopenmp -march=native src/*.cpp -o bin/sparkchess

# Grant executable permissions
chmod +x bin/sparkchess
```

#### On Windows
- :Use the internal Bat to build the exe version 




---

## 2. Basic UCI Usage

SparkChess conforms to the standard UCI protocol. Launch the executable from a terminal or connect it to any chess GUI (Arena, Cutechess, Bankia, Fritz).

### 2.1 Interactive Terminal Mode
Start the engine directly:
```bash
./sparkchess
```

Common UCI commands:
```text
uci                       # Initialize engine and print engine parameters
isready                   # Check if engine is ready (replies 'readyok')
setoption name Threads value 8
setoption name Hash value 256
position startpos moves e2e4 e7e5
go depth 15               # Search to depth 15
go wtime 300000 btime 300000 winc 2000 binc 2000  # Timed search
quit                      # Terminate the engine
```

---

## 



## 5. Validation & Elo Testing (SPRT)

Once Texel or SPSA tuning is complete, validate that the updated weights produce a measurable Elo increase using Sequential Probability Ratio Testing (SPRT):

```bash
cutechess-cli \
  -engine name=SparkChess_Tuned cmd=./sparkchess-tuned \
  -engine name=SparkChess_Base  cmd=./sparkchess-base \
  -each proto=uci tc=10+0.1 \
  -rounds 2000 \
  -repeat \
  -openings file=openings.pgn format=pgn order=random \
  -sprt elo0=0 elo1=5 alpha=0.05 beta=0.05 \
  -concurrency 10
```
