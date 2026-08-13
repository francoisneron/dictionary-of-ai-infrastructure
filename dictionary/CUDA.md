---
description: NVIDIA's GPU computing platform. The layer every inference engine sits on, and most of why NVIDIA hardware is the default.
---

NVIDIA's platform for general-purpose computation on [GPUs](./GPU.md) — a language extension, a compiler, a runtime, and a large stack of optimized libraries. Every mainstream [inference engine](./Inference%20engine.md) ultimately issues CUDA work.

The unit of execution is a kernel: a function compiled to run across thousands of GPU threads at once. Inference performance is largely a question of which kernels run and how well they are written, which is why engine choice matters as much as hardware choice. Several standard optimizations live at this level. Kernel fusion combines a sequence of operations into one launch, avoiding round trips through memory between each step. CUDA Graphs record a repeated sequence of launches and replay it as a unit, removing per-launch CPU overhead that becomes significant when [decode](./Decode.md) steps are only milliseconds long. FlashAttention is a hand-written attention kernel that restructures the computation to keep intermediate values in fast on-chip memory rather than writing them out to [VRAM](./VRAM.md), which makes long [context windows](./Context%20window.md) practical.

Writing kernels directly is specialist work, so Triton exists as a middle layer — a Python-like language that compiles to GPU code and gets much of the performance for far less effort. A growing share of engine code is written in it.

CUDA is also the reason the ecosystem is hard to leave. It is NVIDIA-only, and the accumulated libraries, kernels, and tooling built on it represent years of work that competing platforms have to replicate before their hardware is a practical option regardless of its specifications.

_Usage:_

"Can we run this on the AMD cards? They're cheaper per gigabyte."

"Depends whether your engine has a working non-CUDA backend for this model. The card isn't the problem, the kernel coverage is."
