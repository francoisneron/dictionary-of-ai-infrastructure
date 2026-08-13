---
description: An 8-bit floating point format with native support on Hopper-class GPUs and newer. Half the memory of BF16, modest quality loss.
---

**8-bit floating point.** A numeric [precision](./Precision.md) that stores each value in one byte while keeping a floating point's exponent, so it handles the wide range of magnitudes inside a neural network better than an 8-bit integer does.

What makes FP8 different from other [quantization](./Quantization.md) routes is hardware support. H100-class GPUs and newer implement it natively in their matrix units, so the arithmetic runs at FP8 rather than being unpacked back to a wider format first. That means the saving is not only in memory but in compute throughput too, which helps [prefill](./Prefill.md) as well as [decode](./Decode.md). On older cards the format either isn't supported or is emulated, and the benefit largely disappears — this is the first thing to check before choosing it.

In practice FP8 has become the default middle setting. It halves the [model weights](./Model%20weights.md) against BF16, roughly doubling the room left for [KV cache](./KV%20cache.md), while losing noticeably less quality than INT4 does. For most production serving the trade lands well: you get most of the memory saving with a quality difference that is hard to detect on real traffic.

Two variants exist, differing in how the byte splits between exponent and mantissa. E4M3 carries more precision and less range and is the usual choice for weights and activations; E5M2 carries more range and shows up in training. The [inference engine](./Inference%20engine.md) generally picks for you.

_Usage:_

"We quantized to FP8 and saw no speedup, just the memory saving."

"What card? Below Hopper there's no native FP8, so it's converting back to 16-bit to do the maths. You get the smaller footprint and none of the compute win."
