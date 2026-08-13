---
description: The number format used to store weights and do arithmetic. It sets bytes per parameter, and so how much memory a model needs.
---

The number format used to store [model weights](./Model%20weights.md) and perform arithmetic. It decides bytes per parameter, and therefore both how much memory a model occupies and how fast that memory can be read.

Training generally happens at higher precision than inference needs, so serving a model in a narrower format is routine rather than a compromise. Formats differ in two ways: how many bits, and how those bits divide between range and detail. BF16 keeps the exponent range of FP32 with fewer mantissa bits, which is why it tolerates the wide value swings inside neural networks better than FP16 does at identical size.

| Format          | Bytes/param | 70B weights | Notes                                                           |
| --------------- | ----------- | ----------- | --------------------------------------------------------------- |
| FP32            | 4           | ~280 GB     | Full precision. Rarely used for inference.                      |
| FP16            | 2           | ~140 GB     | Long-standing default. Narrow exponent range.                   |
| BF16            | 2           | ~140 GB     | Same size, wider range. The common default now.                 |
| [FP8](./FP8.md) | 1           | ~70 GB      | Needs Hopper-class hardware or newer.                           |
| INT8            | 1           | ~70 GB      | Integer, usually reached via [quantization](./Quantization.md). |
| INT4            | 0.5         | ~35 GB      | Largest saving, most quality risk.                              |

Mixed precision is the normal arrangement in practice — weights stored in one format, accumulation done in a wider one, and sensitive layers kept full width. The [inference engine](./Inference%20engine.md) handles that; the format you choose is the one for the weights.

Lower precision buys three things at once: a smaller [VRAM budget](./VRAM%20budget.md), more room left for [KV cache](./KV%20cache.md), and faster [decode](./Decode.md), since [memory bandwidth](./Memory%20bandwidth.md) is the bottleneck and there are fewer bytes to move. The cost is accuracy, which degrades gradually rather than failing outright.

_Usage:_

"Can we run everything at INT4 and use smaller cards?"

"Sometimes. Measure output quality on your own prompts first — the loss doesn't show up in a smoke test, it shows up on the hard inputs."
