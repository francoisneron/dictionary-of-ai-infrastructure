---
description: One run of data through the model to produce output. The unit of work every inference metric is ultimately counting.
---

One run of input through the model's layers to produce output. It is the unit of work that inference consists of, and everything measured in this dictionary is ultimately counting forward passes or the [tokens](./Token.md) they produce.

Mechanically it is a sequence of large matrix multiplications interleaved with attention. The input tokens are turned into vectors, and each layer transforms them in turn, reading the [model weights](./Model%20weights.md) for that layer as it goes. Attention layers additionally compare tokens against one another, which is where the [KV cache](./KV%20cache.md) is read and written. The final layer produces a probability distribution over the [tokenizer](./Tokenizer.md) vocabulary, and one token is selected from it.

The same operation behaves like two different workloads depending on how many tokens it processes at once. A pass over a whole prompt has thousands of tokens of parallel work and saturates the arithmetic units, which is [prefill](./Prefill.md) and is [compute bound](./Compute%20bound.md). A pass producing a single next token has almost no parallel work and spends its time reading weights, which is [decode](./Decode.md) and is [memory bound](./Memory%20bound.md). Recognising that one mechanism has these two regimes explains most of what looks inconsistent about inference performance.

No state persists between passes except the KV cache. The weights are read-only, so nothing a request does can affect another, which is what makes batching and replication straightforward.

_Usage:_

"Is generating 500 tokens one operation or 500?"

"500 forward passes, one per token, each reading the whole model. That's why output length drives cost far more than input length does."
