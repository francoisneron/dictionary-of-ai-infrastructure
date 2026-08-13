---
description: Letting requests join and leave the running batch as they arrive and finish, instead of processing fixed groups together.
---

A scheduling approach where sequences enter and leave the in-flight batch independently, rather than being grouped before execution and held together until all of them finish. It is the default in every current [inference engine](./Inference%20engine.md) and the single biggest reason modern serving outperforms naive serving.

The problem it solves is idle time created by variance. Generation lengths differ enormously — one request answers in 20 [tokens](./Token.md), another in 800 — and older approaches had to keep the whole batch running until the longest finished:

| Approach   | How a request joins                                     | Cost                                                                       |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Static     | Fixed group assembled before execution                  | Whole batch waits for the slowest; short requests hold slots doing nothing |
| Dynamic    | Group assembled from whatever has arrived by a deadline | Removes the wait to fill, keeps the wait to finish                         |
| Continuous | Any step, as slots free                                 | Neither wait; the batch is refilled every step                             |

Because a [forward pass](./Forward%20pass.md) in [decode](./Decode.md) produces exactly one token per sequence, the batch can be recomposed between every step at almost no cost. A finished sequence releases its slot and its [KV cache](./KV%20cache.md) immediately, and a queued request takes its place on the next step. The [GPU](./GPU.md) stays full even under highly variable traffic, which raises [throughput](./Throughput.md) several times over on realistic workloads.

Two consequences follow. [Batch size](./Batch%20size.md) stops being a number you set and becomes a ceiling the engine fills. And [TTFT](./TTFT.md) improves as well as throughput, since an arriving request waits at most one decode step rather than for a batch to assemble.

_Usage:_

"Half the batch finishes early and the GPU sits idle until the long one is done."

"That's static batching. Any current engine does continuous batching — finished sequences drop out and queued ones take their slot on the next step."
