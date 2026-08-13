---
description: Moving part of a model into system RAM when it will not fit in VRAM. Makes the impossible possible and the fast slow.
---

Keeping part of a model — usually some layers of the [model weights](./Model%20weights.md), sometimes the [KV cache](./KV%20cache.md) — in system RAM instead of [VRAM](./VRAM.md), and moving it across the PCIe bus when it is needed.

It works, and it is very slow. The reason is bandwidth. On-card [HBM](./HBM.md) runs at several terabytes per second; PCIe Gen5 runs at roughly 60 GB/s, two orders of magnitude less. Since [decode](./Decode.md) is [memory bound](./Memory%20bound.md) and reads every weight it uses once per [token](./Token.md), any layer that has to cross that bus dominates the time for the whole step. Offloading a modest fraction of a model does not cost a modest fraction of the speed; it can cost most of it.

That makes offload a tool for a specific situation rather than a general technique. It is genuinely useful for getting a model running at all on hardware that cannot hold it — local experimentation, a one-off batch job, a development environment where correctness matters and latency does not. It is a poor answer to a production capacity problem, where [quantization](./Quantization.md) or [tensor parallelism](./Tensor%20parallelism.md) address the same shortfall without giving up the memory hierarchy.

The symptom when it is on unintentionally is distinctive: generation that is many times slower than the card should manage, with [GPU utilization](./GPU%20utilization.md) low and steady rather than saturated. Some engines enable offload automatically when a model does not fit, so a deployment can end up in this state without anyone choosing it.

_Usage:_

"It's running, but at three tokens a second on an A100."

"Check whether it silently offloaded layers to CPU when it didn't fit. You're paying PCIe bandwidth per token — quantize it instead so it fits properly."
