---
description: How many sequences the engine processes in one step. The main lever on the throughput-versus-latency trade, and mostly automatic now.
---

The number of sequences an [inference engine](./Inference%20engine.md) processes together in a single step. It is the main lever on the trade between [throughput](./Throughput.md) and [latency](./Latency.md).

Batching pays because [decode](./Decode.md) is [memory bound](./Memory%20bound.md). Producing a token requires reading the [model weights](./Model%20weights.md) out of [VRAM](./VRAM.md), and that read serves every sequence in the batch at once. Going from one sequence to sixteen costs barely more time per step but produces sixteen times the [tokens](./Token.md), so throughput climbs steeply while [TPOT](./TPOT.md) rises only slightly. This is the single largest efficiency gain available in serving, and it is why an unbatched deployment wastes most of the [GPU](./GPU.md).

The gain does not continue indefinitely. Two limits arrive: memory, when the batch's combined [KV cache](./KV%20cache.md) exceeds [KV cache capacity](./KV%20cache%20capacity.md), and compute, when enough sequences are in flight that the arithmetic units saturate and the workload stops being memory bound. Past either point, larger batches add latency without adding throughput — [saturation](./Saturation.md).

Under [continuous batching](./Continuous%20batching.md), which is now standard, batch size is not a number you set directly. Sequences join and leave the running batch as they arrive and finish, so the effective batch fluctuates constantly and what you actually configure is a maximum, plus how much memory the engine may claim. The engine fills the batch as far as those limits allow.

_Avoid:_ using it interchangeably with [concurrency](./Concurrency.md). Concurrency is how many requests are in the system, including those queued; batch size is how many are in the current step.

_Usage:_

"What batch size should we set?"

"With continuous batching you set the ceiling, not the value. Raise the max and the memory fraction until TPOT hits your limit, then stop."
