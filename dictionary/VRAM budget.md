---
description: The accounting that decides whether a deployment works — weights plus KV cache plus activations plus overhead, against the card.
---

The accounting exercise that determines whether a deployment actually works: everything that must live in [VRAM](./VRAM.md) at once, added up and compared against the card. Four things compete for the same fixed number.

| Component                             | What sets it                                                    | How it scales         |
| ------------------------------------- | --------------------------------------------------------------- | --------------------- |
| [Model weights](./Model%20weights.md) | [Parameter count](./Parameter%20count.md) × bytes per parameter | Fixed once loaded     |
| [KV cache](./KV%20cache.md)           | Sequence length × [concurrency](./Concurrency.md)               | Grows with traffic    |
| Activations                           | Model architecture, [batch size](./Batch%20size.md)             | Grows with batch      |
| Runtime overhead                      | CUDA context, kernels, buffers, fragmentation                   | Roughly fixed, 1–3 GB |

Only the first is what people check. The habit worth breaking is treating "the model fits" as the answer — weights are a one-time cost paid at load, and the memory left over after that is what determines how many users you can serve. A 70B model quantized onto an 80 GB card might leave 20 GB free; that 20 GB, minus overhead, is the deployment's real capacity, and it is what [KV cache capacity](./KV%20cache%20capacity.md) measures.

The failure this predicts is the characteristic one. A deployment loads cleanly, serves a demo perfectly, then falls over in production — because the demo was one request and production is forty, each holding its own cache. The [OOM](./OOM.md) arrives under load, not at startup, which makes it look like a stability problem rather than an arithmetic one.

Reserve headroom deliberately rather than filling the card. Engines usually expose a fraction of VRAM they are allowed to claim; leaving nothing spare means the first unusually long request takes the service down.

_Usage:_

"It loads with four gigs to spare, so we're fine."

"Four gigs is your entire KV cache budget. At 8k contexts that's a handful of concurrent requests before it starts queueing or dying."
