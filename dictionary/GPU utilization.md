---
description: The percentage of time a GPU has work resident. A high number does not mean the card is doing useful work efficiently.
---

The percentage of time a [GPU](./GPU.md) has work resident on it, as reported by tools like `nvidia-smi`. It is the first number people check and the most frequently misread.

The metric counts time during which at least one kernel is executing. It does not measure how much of the card's arithmetic capacity that kernel is using. A [memory bound](./Memory%20bound.md) kernel stalled on [VRAM](./VRAM.md) reads still counts as busy, so single-request [decode](./Decode.md) can report high utilization while achieving a small fraction of the hardware's throughput. This is why a deployment can look saturated and still get several times more [throughput](./Throughput.md) from more [concurrency](./Concurrency.md).

The reverse misreading also happens. Low utilization during long [prefill](./Prefill.md) phases, or on a workload dominated by queueing rather than computation, points at the scheduler or the client rather than the GPU. In both directions the number tells you whether the card is occupied, not whether it is earning its keep.

Memory utilization is a separate and more actionable figure: what fraction of VRAM is allocated. Since engines usually claim a fixed fraction up front for the [KV cache](./KV%20cache.md) pool, this often reads as constant and high whether or not the cache is being used, so it needs interpreting against the engine's own reported cache usage rather than taken at face value.

_Avoid:_ reporting utilization as evidence of efficiency. Tokens per second per dollar is the number that decides anything; utilization is a diagnostic for explaining it.

_Usage:_

"GPU's at 95%, we're maxed out — time to add another one."

"That just means kernels are running. Check tokens per second against a concurrency sweep first; decode at low batch reads as busy while wasting most of the card."
