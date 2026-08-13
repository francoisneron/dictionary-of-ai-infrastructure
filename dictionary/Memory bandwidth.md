---
description: How fast a GPU can read its own memory. The ceiling on decode speed, because generating each token re-reads the whole model.
---

The rate at which a [GPU](./GPU.md) moves data between its compute units and its own [VRAM](./VRAM.md), measured in terabytes per second. It is the ceiling on how fast a model generates text, and the reason [decode](./Decode.md) behaves so differently from [prefill](./Prefill.md).

The mechanism is simple once stated. Producing one [token](./Token.md) requires reading every weight the model uses for that token, doing a small amount of arithmetic with each, and moving on. A 70B model at BF16 means reading 140 GB per token. On a card with 3.35 TB/s of bandwidth, that puts a floor of roughly 40 ms per token for a single request no matter how fast the arithmetic units are. The GPU spends most of that time waiting on memory, which is what [memory bound](./Memory%20bound.md) means.

This is why [HBM](./HBM.md) exists, why bandwidth is quoted alongside capacity on every data center card, and why the two main levers on generation speed both reduce bytes moved rather than arithmetic done. [Quantization](./Quantization.md) shrinks the [model weights](./Model%20weights.md), so fewer bytes cross the bus per token. Batching amortizes the read: the weights are fetched once and used for every request in the batch, so [throughput](./Throughput.md) rises steeply while per-request speed barely changes.

Prefill is the opposite case. It processes all input tokens together, which gives the arithmetic units enough work that they become the limit instead — [compute bound](./Compute%20bound.md) rather than memory bound. The same GPU is constrained by different hardware depending on which stage it is in.

_Usage:_

"We moved to a card with far more compute and generation didn't get any faster."

"Decode is memory bound — it re-reads the weights every token. You needed more bandwidth, or a smaller model, not more FLOPs."
