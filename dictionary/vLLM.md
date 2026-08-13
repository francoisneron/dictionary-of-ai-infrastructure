---
description: The most widely used open-source LLM inference engine. Introduced PagedAttention, and made continuous batching standard.
---

An open-source [inference engine](./Inference%20engine.md) for large language models, and the default choice for most self-hosted serving. It came out of Berkeley research into how badly the [KV cache](./KV%20cache.md) was being managed, and the answer it produced — [PagedAttention](./PagedAttention.md) — is now in nearly every competing engine.

The problem it identified was allocation, not computation. Engines at the time reserved a contiguous block of [VRAM](./VRAM.md) per request, sized for the maximum possible sequence length. A request that generated 200 [tokens](./Token.md) against a 4,096-token reservation wasted most of it, and the waste was multiplied by every concurrent request. PagedAttention allocates the cache in small fixed blocks instead, the way an operating system pages memory, so a request only holds what it actually uses. The recovered memory translates directly into [KV cache capacity](./KV%20cache%20capacity.md), and from there into [concurrency](./Concurrency.md) and [throughput](./Throughput.md).

Around that sits the rest of what makes it useful: [continuous batching](./Continuous%20batching.md) so finished requests leave the batch immediately and waiting ones join, [prefix caching](./Prefix%20caching.md) for shared prompt beginnings, [chunked prefill](./Chunked%20prefill.md) to stop long prompts stalling generation, [tensor parallelism](./Tensor%20parallelism.md) across GPUs, [quantization](./Quantization.md) support, and an [OpenAI-compatible API](./OpenAI-compatible%20API.md) so it drops in behind existing clients.

It is not always the fastest. TensorRT-LLM generally wins on raw NVIDIA throughput if you are willing to compile per model and per GPU, and SGLang can win where prompts share very long prefixes. vLLM's advantage is that it is fast, general, and supports new models quickly.

_Usage:_

"Why does everyone reach for vLLM first?"

"Continuous batching and PagedAttention out of the box, and it supports new models within days. You'd need a specific reason to start anywhere else."
