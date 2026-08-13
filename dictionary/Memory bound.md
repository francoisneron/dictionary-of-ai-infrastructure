---
description: A workload limited by how fast memory can be read, not by arithmetic. Decode is memory bound, which explains most of its behaviour.
---

A workload whose speed is limited by how fast data moves between memory and the compute units, rather than by how fast the arithmetic runs. The processor spends much of its time waiting, so adding arithmetic capacity changes nothing.

[Decode](./Decode.md) is the canonical memory bound workload in inference, and the reason is structural. Producing one [token](./Token.md) requires reading every weight the model uses for it and doing only a few operations with each value before moving on. There is very little arithmetic per byte fetched, so [memory bandwidth](./Memory%20bandwidth.md) sets the ceiling. A 70B model at BF16 means moving 140 GB per token, and no amount of extra compute makes that faster.

Once you recognise a workload as memory bound, the levers follow directly. Move fewer bytes: [quantization](./Quantization.md) shrinks the [model weights](./Model%20weights.md), so a lower [precision](./Precision.md) speeds up generation as a side effect of using less memory. Or get more work out of each byte: batching reads the weights once and applies them to every request in the batch, which is why [throughput](./Throughput.md) rises so steeply with [concurrency](./Concurrency.md) while per-request speed barely moves. Buying a card with more arithmetic and the same bandwidth does nothing.

The diagnostic sign is a [GPU](./GPU.md) reporting high utilization while delivering low throughput. Utilization counts time spent with work resident, including time stalled on memory, so a memory bound kernel can read as busy while achieving a small fraction of the card's arithmetic capability.

_Usage:_

"We upgraded to a card with double the FLOPs and generation is the same speed."

"Decode is memory bound. The bandwidth barely changed, so neither did tokens per second — you needed more batching, not more compute."
