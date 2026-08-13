---
description: How many requests a deployment is processing at once. The dial connecting KV cache memory to throughput, latency, and cost.
---

The number of requests being processed at the same time. It is the dial that connects almost everything else: memory use, [throughput](./Throughput.md), [latency](./Latency.md), and ultimately cost per request.

Raising concurrency raises throughput, up to a point. Because [decode](./Decode.md) is [memory bound](./Memory%20bound.md), adding requests to an in-flight batch costs almost no extra time — the [model weights](./Model%20weights.md) are read once and used for everyone — so the same hardware produces far more total [tokens](./Token.md) per second. This is why a deployment serving one user at a time is wasting most of the [GPU](./GPU.md) it is paying for.

What limits it is memory rather than compute. Every concurrent request holds its own [KV cache](./KV%20cache.md) for as long as it is alive, so the ceiling is [KV cache capacity](./KV%20cache%20capacity.md): the [VRAM](./VRAM.md) left after the weights load, divided by what each request needs. Longer [context windows](./Context%20window.md) make each request more expensive and push that ceiling down. Configure a limit above what memory can actually hold and requests don't run in parallel — they wait, which shows up as growing [queue depth](./Queue%20depth.md) and rising [TTFT](./TTFT.md) rather than as an error.

Past a certain level, more concurrency stops buying throughput and only adds latency. That point is [saturation](./Saturation.md), and finding where it sits on your own traffic is what a [concurrency sweep](./Concurrency%20sweep.md) is for.

_Avoid:_ using it interchangeably with [batch size](./Batch%20size.md). Concurrency is how many requests are in the system; batch size is how many the engine runs in a single step, and under [continuous batching](./Continuous%20batching.md) those are not the same number.

_Usage:_

"We set max concurrency to 256 to be safe."

"That's well above what your KV cache holds at these context lengths. They won't run in parallel, they'll sit in the queue and inflate your TTFT."
