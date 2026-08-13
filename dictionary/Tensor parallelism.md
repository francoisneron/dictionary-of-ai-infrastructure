---
description: Splitting each layer's matrices across GPUs so they compute one token together. Buys capacity and speed, costs communication.
---

Splitting the matrices inside each layer across several [GPUs](./GPU.md), so every card holds a slice of every layer and all of them work on the same [token](./Token.md) simultaneously. The most common form of [model parallelism](./Model%20parallelism.md) for inference.

Each GPU multiplies its slice of the weights against the input and produces a partial result; the partials are then combined and shared so every card has what the next layer needs. That combination happens through a collective operation over [NCCL](./NCCL.md), typically twice per layer, so an 80-layer model synchronizes across GPUs more than a hundred times per token.

The gains are real and there are two of them. Capacity is the obvious one: four cards give four times the [VRAM](./VRAM.md), so a model that does not fit on one becomes servable, and the [VRAM budget](./VRAM%20budget.md) gains room for [KV cache](./KV%20cache.md). Less obvious is that [decode](./Decode.md) also gets faster, because it is [memory bound](./Memory%20bound.md) — the weights are read in parallel across four cards' worth of [memory bandwidth](./Memory%20bandwidth.md), so time per token drops.

The cost is the chain worth internalising. More tensor parallelism means more GPUs participating in every single token, which means more synchronization per token, which means [communication overhead](./Communication%20overhead.md) grows with the degree of splitting. Past a point the cards spend more time waiting for each other than computing, and adding another GPU makes things slower. Where that point falls depends almost entirely on the interconnect: over [NVLink](./NVLink.md) within one machine, eight-way is routine; over PCIe, even four-way often disappoints; across machines without [RDMA](./RDMA.md) it is usually a mistake.

Keep tensor parallelism inside a machine and use [data parallelism](./Data%20parallelism.md) to scale beyond it.

_Usage:_

"We went from two-way to four-way tensor parallel and throughput dropped."

"Are those four on the same NVLink domain? If two of them are talking over PCIe, the all-reduce every layer is costing more than the extra bandwidth is worth."
