# Running a local model in Pepper Studio

Pepper Studio does **not** bundle a model or an inference engine. You bring two
things: a `llama-server` binary (from llama.cpp) and a `.gguf` model file. Studio
launches `llama-server` for you and talks to it over its OpenAI-compatible API.

## 1. Get `llama-server` (pick ONE)

**A. Download a prebuilt release (easiest).**
Go to <https://github.com/ggml-org/llama.cpp/releases> and download the build for
your OS and hardware:
- NVIDIA GPU → a `cuda` build. Mac (Apple Silicon) → a `macos-arm64` build.
- AMD/Intel GPU → a `vulkan` build. No GPU → a `cpu`/`avx2` build.

Unzip it; `llama-server` (or `llama-server.exe`) is inside. Note its full path.

**B. Build from source (needs a C++ toolchain).**
```bash
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build -DGGML_CUDA=ON     # drop -DGGML_CUDA=ON for a CPU-only build
cmake --build build --config Release -j
# binary: build/bin/llama-server
```
CUDA builds need the CUDA toolkit installed. CPU builds need only a compiler.

## 2. Get a GGUF model

Download a `.gguf` from Hugging Face (search "GGUF"). For low-VRAM cards, a
4B–8B model at `Q4_K_M` is a good start. Put your `.gguf` files in one folder
(e.g. `~/models/gguf`) — that folder is your "models dir" in Studio.

## 3. Point Studio at them

In the **AI → Local GGUF** panel:
1. Put your `llama-server` path in the "llama-server path" field (or leave it blank
   if `llama-server` is on your PATH).
2. Enter your models dir and click **Scan**, then pick a `.gguf`.
3. (Optional) set flags — see below — and click **Start**.
4. When the status reads **ready**, chat uses your local model.

## 4. Tuning for low VRAM (e.g. a 4 GB card)

- **`-ngl`** (GPU layers): start low (e.g. 15–20) and raise until you run out of
  VRAM. `0` = CPU only.
- **`-c`** (context size): smaller context = less memory. Try `4096`.
- **KV cache** `q8_0`: halves KV-cache memory vs `f16` (enable **flash-attn** too).
- **extra args**: e.g. `--threads 6`.

If "Start" reports **llama-server not found**, set the binary path in step 3.1.
The live log under the panel shows llama.cpp's own output — read it if a model
fails to load (it usually says why, e.g. out of memory).
