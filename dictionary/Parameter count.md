---
description: How many learned values a model has. The headline number in a model's name, and the first input to every memory calculation.
---

The number of learned values in a model — the figure in names like Llama 3 70B or Mixtral 8x7B. It is the first input to every memory calculation you will do.

Parameter count times bytes per parameter gives the size of the [model weights](./Model%20weights.md), and therefore the floor of the [VRAM budget](./VRAM%20budget.md). At BF16 that is two bytes each, so a 70B model needs roughly 140 GB before anything else is accounted for. That is more than a single 80 GB card holds, which is why serving that model requires either [quantization](./Quantization.md) or splitting it across GPUs with [tensor parallelism](./Tensor%20parallelism.md).

The number is a rough proxy for output quality and a precise proxy for cost. More parameters means more memory read on every [forward pass](./Forward%20pass.md), which is why larger models generate more slowly on the same hardware even when they fit comfortably. Since [decode](./Decode.md) is [memory bound](./Memory%20bound.md), the weights have to be streamed out of [VRAM](./VRAM.md) once per [token](./Token.md), and roughly speaking, doubling the parameter count halves the tokens per second.

Total parameter count stops predicting speed for [mixture of experts](./Mixture%20of%20experts.md) models, where only part of the network runs on any given token. There the number that predicts compute is [active parameters](./Active%20parameters.md), while total count still predicts memory. Such a model can occupy the VRAM of a very large model while doing the arithmetic of a much smaller one.

_Avoid:_ comparing an MoE model to a dense one by total parameter count alone — the two numbers are not measuring the same thing.

_Usage:_

"It's a 70B, so an 80 gig card should do it."

"70B at BF16 is 140 gigs of weights on its own. Either quantize it or run tensor parallel across two cards — and you still need room left for the KV cache."
