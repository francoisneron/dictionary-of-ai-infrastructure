---
description: One process with the model loaded, serving requests. The unit that gets created, destroyed, and billed.
---

A single compute instance running an [inference engine](./Inference%20engine.md) with the [model weights](./Model%20weights.md) loaded, serving requests behind an [endpoint](./Endpoint.md). It is the unit that gets provisioned, scaled, billed, and killed.

A worker owns one or more [GPUs](./GPU.md) and everything in their [VRAM](./VRAM.md): the weights, the [KV cache](./KV%20cache.md) pool, and the runtime. That gives each worker its own independent [KV cache capacity](./KV%20cache%20capacity.md) and therefore its own [concurrency](./Concurrency.md) ceiling. Total capacity for an endpoint is roughly the per-worker ceiling times the number of workers, which is [data parallelism](./Data%20parallelism.md) described from the operations side. A worker running a model split by [tensor parallelism](./Tensor%20parallelism.md) holds several GPUs but is still one worker, because a request uses all of them together.

The platform decides whether a worker is usable through a [health check](./Health%20check.md), and getting that wrong is a common way to break an otherwise correct deployment — a worker still loading weights is alive but not ready, and a probe that cannot tell the difference will kill it and start again.

Workers are stateless between requests, which is what makes the whole model of scaling work — any worker can serve any request, so [load balancing](./Load%20balancing.md) needs no affinity and a failed worker loses only its in-flight work. The exception worth knowing is cached state: a [prefix caching](./Prefix%20caching.md) hit only happens on the worker that has the prefix, so adding workers dilutes hit rates unless routing accounts for it.

The expensive part of a worker's life is its beginning. Starting one means pulling a [container image](./Container%20image.md), loading tens of gigabytes of weights, and often compiling or capturing graphs — the [cold start](./Cold%20start.md). That cost is what makes [scale to zero](./Scale%20to%20zero.md) a real trade rather than an obvious win, and why keeping a worker warm is usually worth its [idle cost](./Idle%20cost.md).

_Usage:_

"We've got four workers, so we can handle four requests at once?"

"Each worker handles many at once — its limit is KV cache capacity, not one. Four workers is four times whatever a single one supports."
