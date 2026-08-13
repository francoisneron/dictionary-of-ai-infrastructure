---
description: What a unit of money buys in throughput. The comparison that matters when choosing hardware, and it has to be measured.
---

The relationship between what infrastructure costs and what it delivers. In practice it means comparing options on [cost per million tokens](./Cost%20per%20million%20tokens.md) rather than on [GPU hour](./GPU%20hour.md) rates, and it is the discipline that keeps hardware decisions honest.

The reason a cheaper card is so often the more expensive choice comes down to how inference actually consumes hardware. A newer GPU may cost twice as much per hour while delivering four times the throughput, because it has more [memory bandwidth](./Memory%20bandwidth.md) for [decode](./Decode.md), native [FP8](./FP8.md) support, and enough [VRAM](./VRAM.md) that the [VRAM budget](./VRAM%20budget.md) leaves real [KV cache capacity](./KV%20cache%20capacity.md) instead of a sliver. That last point compounds: more cache means more [concurrency](./Concurrency.md), and more concurrency means better batching, so the throughput advantage is larger than the specification difference suggests.

It is not a fixed property of a card, which is why it has to be measured rather than looked up. The ranking depends on the model, the [inference engine](./Inference%20engine.md), the [quantization](./Quantization.md), and above all the [workload shape](./Workload%20shape.md) — prefill-heavy traffic rewards arithmetic, decode-heavy traffic rewards bandwidth, and the same two cards can swap places between them. A [benchmark](./Benchmark.md) on your own traffic — specifically a [concurrency sweep](./Concurrency%20sweep.md) — is the only way to settle it.

Two adjustments make the comparison fair. Use [goodput](./Goodput.md) rather than raw throughput, since capacity that misses your latency targets is not capacity you can sell. And include [idle cost](./Idle%20cost.md): a card that is twice as fast finishes the same work in half the hours, which improves its position further on any workload that is not running flat out.

_Usage:_

"The older cards are half the price. Shouldn't we run more of those?"

"Benchmark both on our traffic. If the newer one does three times the tokens per second, it's cheaper per token and you need fewer of them to hit the same latency."
