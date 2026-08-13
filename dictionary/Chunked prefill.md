---
description: Splitting long prompt processing into pieces so it interleaves with generation instead of stalling everyone else's stream.
---

Breaking [prefill](./Prefill.md) for a long prompt into several smaller pieces, processed across multiple steps and interleaved with ongoing [decode](./Decode.md), instead of running the whole prompt in one uninterruptible block.

The problem is a scheduling collision between two workloads with opposite shapes. Prefill is [compute bound](./Compute%20bound.md) and can occupy the [GPU](./GPU.md) for hundreds of milliseconds on a long prompt. Decode is [memory bound](./Memory%20bound.md) and needs to run every few milliseconds to keep streams moving. When a 30,000-token prompt arrives, an engine without chunking runs that prefill to completion, and every request currently generating stops dead for its duration. Users who were mid-response watch their [streaming](./Streaming.md) output freeze for reasons entirely unrelated to their own request.

Chunking caps how much prefill work any single step may contain. A long prompt is processed over several steps, and each of those steps also carries the decode work for everyone else. The long request's own [TTFT](./TTFT.md) gets slightly worse, since its prefill is now spread out; everybody else's [TPOT](./TPOT.md) stops spiking. Given that the alternative concentrates the pain on innocent requests, this is almost always the right trade for interactive serving.

There is a throughput cost to weigh. Splitting prefill means the arithmetic units are less fully saturated in each step, so a batch-processing workload with no latency requirement may be better off without it. The distinction is whether anyone is waiting on a stream.

_Usage:_

"Whenever someone submits a big document, everyone else's output stutters."

"One long prefill is blocking the decode steps. Turn on chunked prefill and cap the per-step token budget — it interleaves instead of monopolising."
