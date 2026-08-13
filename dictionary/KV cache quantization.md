---
description: Storing cached attention state at lower precision. Buys concurrency directly, and is a separate decision from quantizing weights.
---

Storing the [KV cache](./KV%20cache.md) at reduced [precision](./Precision.md) — typically FP8 or INT8 instead of the model's native 16-bit — so each cached [token](./Token.md) costs half the memory or less.

It is a distinct decision from [quantization](./Quantization.md) of the [model weights](./Model%20weights.md), and the two are configured separately. Weight quantization reduces the fixed cost paid once at load; cache quantization reduces the variable cost paid per token of every in-flight request. Which one helps more depends on where your memory is actually going. A small model serving very long contexts can easily spend more [VRAM](./VRAM.md) on cache than on weights, and in that case quantizing the cache is the larger win by a wide margin.

The effect goes straight through to capacity. Halving the per-token cost doubles [KV cache capacity](./KV%20cache%20capacity.md) for the same free memory, which doubles the [concurrency](./Concurrency.md) ceiling, which raises [throughput](./Throughput.md) and lowers [cost per million tokens](./Cost%20per%20million%20tokens.md). It also reduces the bytes read per attention step, which helps [decode](./Decode.md) slightly since that is [memory bound](./Memory%20bound.md).

Quality behaves differently from weight quantization and deserves its own evaluation. Errors in cached keys and values accumulate along a sequence rather than staying local, so degradation tends to show up on long contexts specifically — the case you probably enabled it for. FP8 is generally safe in practice; INT4 caches are noticeably risky. Test on your longest realistic inputs, not your typical ones.

_Usage:_

"We quantized the weights and still can't get concurrency up."

"At 32k contexts your cache is bigger than your weights. Quantize the KV cache to FP8 — that's where the memory actually is."
