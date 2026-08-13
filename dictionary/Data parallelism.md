---
description: Running whole copies of a model on separate GPUs and spreading requests between them. Buys throughput, never capacity.
---

Running complete, independent copies of a model on separate [GPUs](./GPU.md) and distributing incoming requests among them. Each replica serves a request entirely on its own, and the replicas never talk to each other.

It is the simplest form of scaling and the one to reach for first. Because [model weights](./Model%20weights.md) are read-only during inference, replicas share nothing and need no coordination — no collective operations, no [NCCL](./NCCL.md), no sensitivity to interconnect quality. Two replicas serve twice the [throughput](./Throughput.md) of one, and the scaling stays close to linear as long as [load balancing](./Load%20balancing.md) spreads work evenly.

What it does not do is raise capacity. Every replica needs the full [VRAM budget](./VRAM%20budget.md) to itself, so a model that does not fit on one card does not fit on four either — that requires [tensor parallelism](./Tensor%20parallelism.md) or [pipeline parallelism](./Pipeline%20parallelism.md). Data parallelism also leaves per-request [latency](./Latency.md) unchanged, since a request is served by a single GPU exactly as it would have been alone.

Note that memory is paid per replica, and that includes the [KV cache](./KV%20cache.md) pool. Four replicas each hold their own cache, so a prompt that would have been a [prefix caching](./Prefix%20caching.md) hit is only a hit if the request lands on the replica that has it — one of the few places where replica-aware [routing](./Load%20balancing.md) is worth the complexity.

In production it is usually combined rather than chosen: tensor parallelism inside each machine to make the model fit and to use the local interconnect, data parallelism across machines to scale out.

_Usage:_

"Can we run the 70B across four cards with data parallelism?"

"Data parallel means four full copies, and one copy doesn't fit. You need tensor parallelism for that — data parallelism only helps once the model already fits."
