---
description: The accelerator model inference runs on. Chosen for memory capacity and bandwidth at least as much as for arithmetic speed.
---

**Graphics Processing Unit.** The accelerator nearly all model inference runs on. A GPU is thousands of simple cores operating in parallel, attached to its own memory, and it suits inference because a [forward pass](./Forward%20pass.md) is mostly large matrix multiplications.

Data center GPUs add dedicated matrix hardware — NVIDIA calls these Tensor Cores — which handle the multiply-accumulate work that dominates neural network computation, and run it faster at reduced [precision](./Precision.md). Getting at any of this from software goes through [CUDA](./CUDA.md), which is a large part of why NVIDIA hardware is the default.

When choosing a GPU for serving, the specification that matters first is usually not arithmetic speed. It is memory. How much [VRAM](./VRAM.md) the card has decides whether the [model weights](./Model%20weights.md) fit at all and how much room is left for [KV cache](./KV%20cache.md); how much [memory bandwidth](./Memory%20bandwidth.md) it has decides how fast [decode](./Decode.md) runs. Two cards with similar advertised compute can perform very differently on the same workload for this reason.

Comparing GPUs by hourly price is the common mistake. A card costing twice as much per hour that produces four times the [throughput](./Throughput.md) is half the price on the metric that actually bills, which is [cost per million tokens](./Cost%20per%20million%20tokens.md). The right comparison is [price performance](./Price%20performance.md) measured on your own [workload shape](./Workload%20shape.md), not inferred from a spec sheet.

_Usage:_

"Let's just take the cheapest card the model fits on."

"Fitting isn't the bar. Check what's left after the weights load — that's your KV cache budget, and a card with no headroom serves one request at a time."
