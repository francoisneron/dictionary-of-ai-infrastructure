---
description: The parameters actually used on a given token. What predicts speed in an MoE model, where total count predicts memory instead.
---

The subset of a model's parameters that actually participate in producing a given [token](./Token.md). In a dense model this is all of them; in a [mixture of experts](./Mixture%20of%20experts.md) model it is a small fraction, because the router sends each token to only a few experts.

The number matters because it, not the total [parameter count](./Parameter%20count.md), is what predicts generation speed. [Decode](./Decode.md) is [memory bound](./Memory%20bound.md): the time to produce a token is dominated by reading the weights involved out of [VRAM](./VRAM.md). If only 13 billion of a model's 47 billion parameters are read per token, the [memory bandwidth](./Memory%20bandwidth.md) cost is that of a 13B model, and the tokens per second follow.

Holding both numbers at once is the habit worth building. Total parameters tell you what will fit — every expert has to be resident, since any token might route to any of them. Active parameters tell you how fast it will run once it fits. A model can be expensive to host and cheap to run, and quoting either number alone gives a misleading picture of the deployment.

The gap between the two is also why MoE models are attractive on hardware with plenty of memory and unremarkable bandwidth, and unattractive on the reverse. It is worth checking against the specific card rather than assuming, because the ratio varies a lot between architectures.

_Usage:_

"The 47B model is generating faster than the 34B dense one. Is the benchmark wrong?"

"It's an MoE — about 13B active per token. It reads a third of the weights, so it decodes faster. It still needs the memory for all 47."
