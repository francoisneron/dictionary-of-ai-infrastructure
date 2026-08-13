---
description: Out of memory. The failure when a workload needs more VRAM than is free — usually under load rather than at startup.
---

**Out of memory.** The failure that occurs when an allocation cannot be satisfied because there is not enough free [VRAM](./VRAM.md). On a GPU it is generally fatal to the request and often to the [worker](./Worker.md) process, since the runtime has no way to shed memory and continue.

The timing is what makes OOM confusing. A deployment that OOMs at startup has an obvious problem: the [model weights](./Model%20weights.md) do not fit and the [VRAM budget](./VRAM%20budget.md) was wrong. Far more common is the deployment that starts cleanly, serves traffic for hours, and then dies — because the weights were only the fixed part of the budget, and the [KV cache](./KV%20cache.md) grows with every additional concurrent request and every additional [token](./Token.md) of context. The service did not become unstable; it met its actual peak for the first time.

Two patterns account for most production OOMs. One is a [concurrency](./Concurrency.md) limit set above what [KV cache capacity](./KV%20cache%20capacity.md) can support, so a traffic spike admits more requests than there is memory for. The other is an unusually long request — someone pastes a large document — expanding one cache far beyond the typical size. Both are capacity planning failures rather than bugs.

The fixes are the levers from elsewhere in this dictionary: [quantize](./Quantization.md) to shrink the weights, cap the [context window](./Context%20window.md) to bound worst-case cache per request, lower the concurrency limit so the engine queues instead of dying, or move to a card with more memory. Fragmentation used to be a third cause; [PagedAttention](./PagedAttention.md) largely removed it.

_Usage:_

"It OOMs maybe twice a day, always in the afternoon."

"That's your peak traffic, not a leak. The concurrency limit is above what the KV cache can hold — lower it and requests queue instead of the worker dying."
