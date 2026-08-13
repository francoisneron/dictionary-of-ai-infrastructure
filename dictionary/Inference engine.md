---
description: The software that loads a model and serves requests against it. Where batching, KV cache management and scheduling actually live.
---

The software that loads [model weights](./Model%20weights.md) onto a [GPU](./GPU.md) and turns incoming requests into [forward passes](./Forward%20pass.md). It owns the scheduler, the [KV cache](./KV%20cache.md), the batching strategy, and the [CUDA](./CUDA.md) kernels — which makes engine choice roughly as consequential as hardware choice.

Running a model with plain PyTorch works and is several times slower than it needs to be, because none of the serving-specific machinery is there: no [continuous batching](./Continuous%20batching.md), no paged cache allocation, no [prefix caching](./Prefix%20caching.md), no [speculative decoding](./Speculative%20decoding.md). Those are the optimizations that separate a demo from a deployment, and they live here rather than in the model.

| Engine            | Optimizes for                       | Notes                                                                        |
| ----------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| [vLLM](./vLLM.md) | Throughput on NVIDIA GPUs           | The common default. PagedAttention, continuous batching, wide model support. |
| TensorRT-LLM      | Peak NVIDIA performance             | Compiles per model and GPU. Fastest, least flexible, slow to build.          |
| SGLang            | Structured and multi-turn workloads | Strong prefix caching; good where prompts share long prefixes.               |
| TGI               | Hugging Face integration            | Straightforward operationally, closely tracks the hub.                       |
| llama.cpp         | Local and quantized use             | CPU and consumer GPUs, GGUF weights. Not aimed at high concurrency.          |

Most expose an [OpenAI-compatible API](./OpenAI-compatible%20API.md), so the engine is usually swappable without touching client code — which makes it worth running a [benchmark](./Benchmark.md) on two of them against your own [workload shape](./Workload%20shape.md) rather than accepting a published comparison.

Engines also determine [cold start](./Cold%20start.md) behaviour. Ones that compile or capture graphs at startup trade a slower launch for faster steady-state serving, which matters a great deal if [workers](./Worker.md) are created and destroyed frequently.

_Usage:_

"We're serving it with a FastAPI wrapper around transformers."

"That's leaving most of the card on the floor. vLLM will do several times the throughput on the same GPU, mostly from continuous batching."
