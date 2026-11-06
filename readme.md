# SparkChess 3.0 Manual


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

## 3.Pytorch NNUE Trainer Manual
# NNUE PyTorch Trainer User Guide

This document provides instructions on how to set up and use the NNUE PyTorch trainer for model training and exporting. Depending on your local environment setup preferences, the guide is divided into two scenarios: **Training without a Virtual Environment** and **Training with a Virtual Environment**.

## Scenario 1: Training without a Virtual Environment

If you are training directly in your system's global Python environment, please follow the steps below:

### 1. Environment Preparation & Dependency Installation

1. **Python Version Requirement**: **Python 3.11** is recommended.

2. **Install Basic Dependencies**: Open Command Prompt (CMD) in the root directory of the trainer and use `pip` to install the required dependencies listed in `requirements.txt`:

   ```cmd
   pip install -r requirements.txt
   ```

3. **Install PyTorch (CUDA Version)**: Based on your current Python version and GPU driver support, visit the [Official PyTorch Website](https://pytorch.org/get-started/locally/) to obtain and run the appropriate installation command for CUDA-accelerated PyTorch.

4. **Compile the Data Loader**: Navigate to the trainer folder and run the batch script to generate `training_data_loader.dll`:

   ```cmd
   build-dataloader-windows.bat
   ```

### 2. Dataset Preparation & Starting the Training

1. **Obtain the Dataset**:
   You can download `.binpack` dataset files from the official HuggingFace repository:

   * Dataset URL: [official-stockfish/master-binpacks](https://huggingface.co/datasets/official-stockfish/master-binpacks/tree/main)

   * **Training Recommendation**: It is recommended to use a dataset of around **5GB** and train for **20 - 25 epochs**.

2. **Run the Training Command**:
   Once the preparation is complete, run the following command in the command line to start training:

   ```cmd
   python train.py "path/to/your_dataset.binpack" --max-epochs=x
   ```

   > **Parameter Description**:
   >
   > * `"path/to/your_dataset.binpack"`: Replace this with the actual file path and name of your `.binpack` dataset.
   >
   > * `--max-epochs=x`: Replace `x` with your desired number of training epochs (e.g., `--max-epochs=25`).

### 3. Exporting (Serializing) the NNUE Model File

After training is complete, you need to convert the generated checkpoint file (`.ckpt`) into the `.nnue` format usable by the engine.

1. **Run the Serialization Command**:

   ```cmd
   python serialize.py "logs\training_logs\version_x\checkpoints\last.ckpt" "..\engine\custom_512x2.nnue" --features="HalfKAv2^" --l1=512 --l2=16 --l3=32
   ```

   > **Note**: `version_x` in the path (e.g., `version_0`, `version_1`, etc.) varies depending on your training runs and parameters. Please check the `logs\training_logs` folder first to locate the directory containing the latest checkpoint file.

2. **Deployment & Application**:
   Ensure that the generated `.nnue` file and the engine binary file (`.exe`) are placed in the **same directory**. The engine will automatically load the network file upon startup.

## Scenario 2: Training with a Virtual Environment

If you prefer to keep your system environment clean by using a virtual environment (such as `venv` or `conda`) for training, please follow the workflow below:

### 1. Navigate to the Directory & Activate the Virtual Environment

1. Open Command Prompt (CMD) and navigate to the `nnue-pytorch` folder:

   ```cmd
   cd /d "path\to\your\nnue-pytorch"
   ```

2. **Activate the Virtual Environment** (choose the activation command based on the tool and location where you installed your virtual environment):

   * **If you are using `venv`**:

     ```cmd
     # Assuming the virtual environment folder is named venv and is in the current directory
     .\venv\Scripts\activate
     ```

   * **If you are using `conda`**:

     ```cmd
     conda activate your_env_name
     ```

### 2. Configuration & Training

Once the virtual environment is successfully activated (you will see `(your_env_name)` at the beginning of the command prompt), all subsequent steps are identical to **Scenario 1**:

1. Run `pip install -r requirements.txt` to install dependencies, and install the matching PyTorch CUDA version.

2. Run `build-dataloader-windows.bat` to generate `training_data_loader.dll`.

3. Use the `python train.py` command to load the dataset and start training.

4. Use the `python serialize.py` command to export the `.ckpt` file to a `.nnue` file and place it in the same directory as the engine binary.



## 4. Validation & Elo Testing (SPRT)

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
