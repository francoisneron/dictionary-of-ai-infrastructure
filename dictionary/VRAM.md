---
description: The memory attached to a GPU. Weights, KV cache, activations and runtime overhead all have to fit inside it.
---

The memory physically attached to a [GPU](./GPU.md). Everything a deployment needs has to fit in it: the [model weights](./Model%20weights.md), the [KV cache](./KV%20cache.md), the activations produced during computation, and the inference runtime's own overhead.

VRAM is the binding constraint on most inference deployments, and it is fixed — you cannot add more to a card. On data center GPUs it is [HBM](./HBM.md), stacked beside the die for bandwidth rather than socketed as separate modules. Capacity currently runs from 24 GB on consumer cards to 141 GB on an H200, which is why that one number drives so many deployment decisions.

The mistake worth naming is treating "the model fits in VRAM" as the end of the sizing question. Weights are a fixed cost paid once at load. The KV cache grows with every [token](./Token.md) of every in-flight request, so the memory left over after loading is what actually decides how many users you can serve at once. A 70B model quantized onto an 80 GB card might leave 20 GB free, and that 20 GB — not the 80 — is your real capacity. Accounting for this properly is what the [VRAM budget](./VRAM%20budget.md) is for.

When it runs out you get [OOM](./OOM.md), and usually not at startup. The failure arrives later, under [concurrency](./Concurrency.md), when a burst of long requests expands the cache past whatever headroom was left.

_Usage:_

"It loaded fine on the 48 gig card, so we're good."

"Loading is the easy part. Check what's free afterwards — that's your KV cache budget, and it's the thing that sets your concurrency ceiling."
