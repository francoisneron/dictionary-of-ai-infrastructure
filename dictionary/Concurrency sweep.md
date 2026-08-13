---
description: Measuring performance across rising concurrency levels. The one benchmark that shows where your capacity limits actually are.
---

A [benchmark](./Benchmark.md) that repeats the same workload at increasing levels of [concurrency](./Concurrency.md) — 1, 2, 4, 8, 16, 32 and upward — recording [throughput](./Throughput.md) and latency percentiles at each. It produces the curve that a single measurement cannot.

The curve has a consistent shape, and each part of it answers a question. At low concurrency, throughput climbs nearly linearly while [TPOT](./TPOT.md) barely moves: batching is amortizing the [model weights](./Model%20weights.md) read across more requests at almost no cost. Then throughput begins to flatten as either [KV cache capacity](./KV%20cache%20capacity.md) or arithmetic runs out. Past that, throughput is flat or falling while [TTFT](./TTFT.md) and [tail latency](./Tail%20latency.md) climb steeply — [saturation](./Saturation.md), where added load produces only waiting.

Three numbers come out of it, and they are the ones deployment configuration needs. The knee in the throughput curve is the highest useful concurrency. The point where latency percentiles cross your targets is where [goodput](./Goodput.md) peaks, and it usually sits below the knee — that is the limit worth configuring. And the throughput at that level, divided by what the hardware costs, is your real [cost per million tokens](./Cost%20per%20million%20tokens.md).

A few details decide whether the result is usable. Hold the [workload shape](./Workload%20shape.md) fixed across levels, or you are varying two things at once. Warm up before each level. Run long enough at each that queues reach steady state, since a short run at high concurrency measures the transient rather than the equilibrium. And watch the engine's own [eviction](./KV%20cache%20eviction.md) counter — preemption starting is often the clearest marker of where the ceiling actually is.

_Usage:_

"What should we set max concurrency to?"

"Sweep it. Find where throughput stops improving, then back off to where p99 TTFT still meets your target — that's the number, and it's usually lower than you'd guess."
