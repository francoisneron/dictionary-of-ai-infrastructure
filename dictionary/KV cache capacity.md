---
description: How much cached attention state the free VRAM can hold. The real ceiling on concurrency, and the number to size a deployment on.
---

How much [KV cache](./KV%20cache.md) the memory left after loading can hold, expressed as total [tokens](./Token.md) across all in-flight requests. It is the number that actually determines how many users a deployment serves, and the one people skip.

The arithmetic is straightforward. Take the card's [VRAM](./VRAM.md), subtract the [model weights](./Model%20weights.md), subtract runtime overhead, and divide what remains by the per-token cache cost of the model. Divide that by the typical sequence length and you have your [concurrency](./Concurrency.md) ceiling — the point past which requests queue rather than run.

Which makes the causal chain concrete: a longer [context window](./Context%20window.md) means more cache per request, which means fewer concurrent requests, which means lower [throughput](./Throughput.md) on the same hardware, which means a higher [cost per million tokens](./Cost%20per%20million%20tokens.md). Nothing about the GPU changed. This is why "the model fits" and "the deployment works" are different claims, and it is what a [VRAM budget](./VRAM%20budget.md) is for.

Every lever available acts on one term of that division:

| Lever                                                       | Effect on capacity          | Cost                        |
| ----------------------------------------------------------- | --------------------------- | --------------------------- |
| Shorter max context                                         | Fewer tokens per request    | Truncates long inputs       |
| [Quantize](./Quantization.md) the weights                   | More free VRAM              | Some accuracy               |
| [KV cache quantization](./KV%20cache%20quantization.md)     | Cheaper per token           | Some accuracy               |
| Add a GPU ([tensor parallelism](./Tensor%20parallelism.md)) | More total VRAM             | Communication overhead      |
| [PagedAttention](./PagedAttention.md)                       | Removes reservation waste   | None, it is strictly better |
| [Prefix caching](./Prefix%20caching.md)                     | Shared prefixes stored once | Only helps shared prompts   |

_Usage:_

"How many concurrent users can this handle?"

"Free VRAM after load, divided by cache-per-token, divided by your average sequence length. Not a number you can guess from the GPU model."
