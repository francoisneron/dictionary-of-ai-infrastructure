---
description: Storing weights at lower precision to cut memory. Frees VRAM for KV cache, speeds up decode, and costs some accuracy.
---

Converting [model weights](./Model%20weights.md) from the [precision](./Precision.md) they were trained at to a narrower one, so the model occupies less memory. A 70B model at BF16 needs around 140 GB; quantized to INT4 it needs around 35 GB, which is the difference between four GPUs and one.

The gains compound in a way worth spelling out, because it is the most useful causal chain in this dictionary. Smaller weights mean a smaller [VRAM budget](./VRAM%20budget.md). A smaller budget leaves more free memory after loading, which is [KV cache capacity](./KV%20cache%20capacity.md). More capacity means higher [concurrency](./Concurrency.md), which means higher [throughput](./Throughput.md) on the same card, which means a lower [cost per million tokens](./Cost%20per%20million%20tokens.md). And separately from all of that, [decode](./Decode.md) gets faster on its own, because it is [memory bound](./Memory%20bound.md) and there are simply fewer bytes to read per [token](./Token.md).

Methods differ in how much they preserve. The naive approach rounds every weight the same way and loses noticeably more quality than it needs to. Better methods use a small calibration dataset to find which weights matter most and keep those at higher precision — AWQ and GPTQ are the two most commonly encountered. [FP8](./FP8.md) is a different route again, using hardware support rather than a conversion pass.

The cost is accuracy, and its shape is what makes it dangerous. Quality degrades gradually rather than breaking, and it degrades most on the hardest inputs, so a smoke test passes while real traffic gets subtly worse. Evaluate on your own prompts before shipping.

_Avoid:_ treating "it still answers correctly" as evidence that quantization was free. Compare against the unquantized model on inputs you actually care about.

_Usage:_

"AWQ got us onto one card instead of two. Ship it?"

"Run your eval set against both first. The failure mode isn't gibberish, it's slightly worse reasoning on the hard cases."
