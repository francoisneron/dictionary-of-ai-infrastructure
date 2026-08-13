---
description: A workload limited by arithmetic capacity rather than memory speed. Prefill is compute bound, which is why long prompts are slow.
---

A workload whose speed is limited by how much arithmetic the hardware can perform, rather than by how fast it can read memory. The compute units stay busy, and going faster means more arithmetic capacity or less work.

[Prefill](./Prefill.md) is the compute bound stage of inference. It processes every input [token](./Token.md) at once, so each weight that gets read is used for thousands of tokens rather than one. That ratio of arithmetic to bytes fetched is high enough that the matrix units become the limit, which is the opposite of [decode](./Decode.md) and the reason the two stages respond to different hardware. It is also why prefill time grows with prompt length in a way generation time does not: doubling the prompt genuinely doubles the arithmetic.

Because prefill is compute bound, it benefits from the things that raise arithmetic throughput — Tensor Cores, lower [precision](./Precision.md) formats with hardware support like [FP8](./FP8.md), and the kernel work that [CUDA](./CUDA.md) libraries provide. Batching helps it far less than it helps decode, since the units are already saturated by a single long prompt.

The practical consequence is that a workload's [shape](./Workload%20shape.md) decides which limit you are against. Long prompts with short answers are prefill-heavy and compute bound, so a card with strong arithmetic wins. Short prompts with long answers are decode-heavy and [memory bound](./Memory%20bound.md), so [memory bandwidth](./Memory%20bandwidth.md) wins. A [benchmark](./Benchmark.md) with the wrong ratio measures the wrong bottleneck and picks the wrong GPU.

_Usage:_

"Our RAG requests take ages to start but stream fine once they do."

"You're prefill-heavy — 20k of retrieved context is compute bound work before the first token. Chunked prefill will stop it blocking everyone else."
