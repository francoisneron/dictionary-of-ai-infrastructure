---
description: Reclaiming cached attention state when memory runs out. The engine's alternative to failing, and it costs recomputation.
---

Removing cached attention state to free [VRAM](./VRAM.md) when there is not enough for the requests currently in flight. It is what an [inference engine](./Inference%20engine.md) does instead of an [OOM](./OOM.md), and it is not free.

Eviction happens because the [KV cache](./KV%20cache.md) grows unpredictably. Requests do not announce how long their output will be, so an engine admits work based on an estimate and can find itself over-committed when several requests all generate more than expected. At that point something has to give.

Engines have two options and use both. Preemption suspends a request and discards its cache entirely; when it resumes, the discarded state has to be rebuilt by re-running [prefill](./Prefill.md) over everything it had already processed. Swapping copies the cache to system RAM instead and copies it back, which avoids recomputation but pays PCIe transfer time in each direction — the same bandwidth problem that makes [CPU offload](./CPU%20offload.md) slow. Cached prefixes from [prefix caching](./Prefix%20caching.md) are usually evicted first, since they are an optimization rather than live state.

The symptom is distinctive and easy to misread. [Throughput](./Throughput.md) drops while [GPU utilization](./GPU%20utilization.md) stays high, because the card is busy redoing work it already did. [Tail latency](./Tail%20latency.md) gets much worse for the preempted requests specifically, since they effectively start over. It looks like the model got slower; what actually happened is that [concurrency](./Concurrency.md) exceeded [KV cache capacity](./KV%20cache%20capacity.md) and the engine is thrashing.

Frequent eviction is a sizing signal, not something to tune around. Admit fewer requests, shorten the [context window](./Context%20window.md), or add memory.

_Usage:_

"Throughput collapsed at peak but the GPU still shows fully busy."

"Check the engine's preemption counter. If it's evicting, it's re-prefilling the same requests over and over — you're admitting more than the cache can hold."
