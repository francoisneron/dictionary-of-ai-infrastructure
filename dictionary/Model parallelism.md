---
description: Splitting one model across several GPUs so it fits or runs faster. The umbrella term for tensor, pipeline and expert parallelism.
---

Splitting a single model's work across multiple [GPUs](./GPU.md). The umbrella term for several distinct strategies that differ in what gets cut and what it costs to stitch back together.

You reach for it for one of two reasons. Either the [model weights](./Model%20weights.md) do not fit on one card — a 70B model at BF16 needs 140 GB and no single GPU has that — or they fit but leave too little room for [KV cache](./KV%20cache.md) to serve useful [concurrency](./Concurrency.md). The second reason is the more common one in practice, and the one people arrive at after discovering their [VRAM budget](./VRAM%20budget.md) was optimistic.

| Strategy                                | What is split                          | Communication per token       | Buys you                                                       |
| --------------------------------------- | -------------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| [Tensor](./Tensor%20parallelism.md)     | Each layer's matrices, across all GPUs | High — every layer, twice     | Capacity and lower latency                                     |
| [Pipeline](./Pipeline%20parallelism.md) | Layers into sequential stages          | Low — once per stage boundary | Capacity across loose interconnects                            |
| [Data](./Data%20parallelism.md)         | Nothing; whole copies                  | None between replicas         | Throughput, not capacity                                       |
| [Expert](./Expert%20parallelism.md)     | MoE experts across GPUs                | Moderate — routing per layer  | Capacity for [mixture of experts](./Mixture%20of%20experts.md) |

The distinction that matters most is the first against the third. Tensor parallelism puts one model on several GPUs, so a single request uses all of them. Data parallelism puts several copies of the model on several GPUs, so each request uses one. The first raises the ceiling on model size and can lower [latency](./Latency.md); the second raises [throughput](./Throughput.md) and does nothing for a model that does not fit.

These compose. A common production shape is tensor parallelism within a machine, where [NVLink](./NVLink.md) is fast, and data parallelism across machines.

_Usage:_

"We've got eight GPUs and a model that fits on two. How do we split it?"

"Four data-parallel replicas of a two-way tensor-parallel model. Don't spread one model over all eight — you'd add communication overhead for capacity you don't need."
