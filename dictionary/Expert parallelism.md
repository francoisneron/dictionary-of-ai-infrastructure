---
description: Distributing an MoE model's experts across GPUs. Maps to how the model actually computes, but load depends on routing.
---

Placing different experts of a [mixture of experts](./Mixture%20of%20experts.md) model on different [GPUs](./GPU.md), so each card holds a subset of the experts rather than a slice of every one. Tokens are routed to whichever GPU holds the expert they need.

It exists because MoE models fit the other strategies badly. The whole architecture is built on only a fraction of the network running per [token](./Token.md), and splitting every expert across every card with [tensor parallelism](./Tensor%20parallelism.md) throws that structure away — every GPU ends up participating in every token anyway, which is what MoE was designed to avoid. Assigning whole experts to whole GPUs preserves the sparsity: a token activates two experts, so it touches two cards.

The communication pattern is different from tensor parallelism's. Rather than synchronizing partial results twice per layer, tokens are dispatched to the GPUs holding their chosen experts and the outputs are gathered back — an all-to-all exchange, once per MoE layer. Volume is lower than tensor parallelism's all-reduces, but the pattern is less regular and more sensitive to [network topology](./Communication%20overhead.md).

The failure mode is unique to this strategy and worth knowing: load imbalance. Routing is learned, not uniform, so some experts are chosen far more often than others. A GPU holding two popular experts becomes the bottleneck for every step while cards holding unpopular ones idle, and the slowest card sets the pace. Models are trained with balancing losses to reduce this, and serving frameworks can replicate hot experts across several GPUs, but it remains the thing to check when an MoE deployment underperforms its arithmetic.

_Usage:_

"Expert parallel across eight cards and utilization is lopsided — two are pinned, the rest are half idle."

"Routing isn't uniform. Those two hold the popular experts. Replicate the hot ones across more GPUs, or rebalance the placement."
