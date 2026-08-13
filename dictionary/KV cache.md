---
description: Stored attention state for tokens already processed. It makes generation linear instead of quadratic, and it eats leftover VRAM.
---

The stored attention keys and values for every [token](./Token.md) a request has already processed. It exists so that producing the next token doesn't require recomputing the whole sequence, and it is the largest variable consumer of [VRAM](./VRAM.md) in a running deployment.

Attention works by comparing each token against every token before it. Without a cache, producing token 1,000 would mean redoing the work for tokens 1 through 999, and the cost of a response would grow with the square of its length. Caching the keys and values turns each new token into a comparison against stored state instead: linear, not quadratic. This is what makes [decode](./Decode.md) practical at all.

The cost is memory, and it scales in a way that surprises people. The cache grows with sequence length, with the number of simultaneous requests, and with model size, and every byte of it competes with the [model weights](./Model%20weights.md) for the same fixed VRAM. A deployment that loads comfortably can still fall over under load, because the weights are a fixed cost and the cache is not. How much of it you can hold is [KV cache capacity](./KV%20cache%20capacity.md), and that is the number that really sets your [concurrency](./Concurrency.md).

Because it is both large and unpredictable, the cache is where most [inference engine](./Inference%20engine.md) optimization is aimed: [PagedAttention](./PagedAttention.md) to allocate it without waste, [prefix caching](./Prefix%20caching.md) to reuse it across requests, [KV cache quantization](./KV%20cache%20quantization.md) to shrink it, and [eviction](./KV%20cache%20eviction.md) for when there is no room left.

_Usage:_

"Memory climbs all afternoon and then it OOMs. The model isn't changing."

"That's KV cache, not weights. More concurrent requests and longer conversations both grow it — you're running out of the headroom left after load."
