---
description: An architecture where only part of the network runs on each token. Memory scales with total parameters, speed with active ones.
---

An architecture that splits parts of the model into many parallel subnetworks — experts — and routes each [token](./Token.md) to only a few of them. A small router network picks which experts handle which token, so most of the model sits idle on any given step.

The point is to break the usual link between model size and cost per token. A dense model runs every parameter for every token, so doubling [parameter count](./Parameter%20count.md) doubles the work. An MoE model can hold far more parameters while running a fixed, small fraction of them, which buys the quality that comes with scale without the matching compute bill. Mixtral 8x7B and DeepSeek's larger models are the familiar examples.

The infrastructure consequence is that the two numbers you care about come apart, and this is where MoE surprises people. All the experts have to be resident in [VRAM](./VRAM.md), because any token might route to any of them, so memory is set by the total parameter count. Only the [active parameters](./Active%20parameters.md) are read per token, so speed is set by a much smaller number. You end up provisioning memory for a very large model and getting the [decode](./Decode.md) speed of a much smaller one — good value, but only if you sized the [VRAM budget](./VRAM%20budget.md) on the total.

Serving one across multiple GPUs also needs a different strategy. Splitting every layer with [tensor parallelism](./Tensor%20parallelism.md) works, but distributing whole experts across devices with [expert parallelism](./Expert%20parallelism.md) usually maps better onto how the model actually computes.

_Usage:_

"It's 8x7B, so about 56 billion — call it a 56B model."

"For memory, yes. For speed it behaves like a 13B, because only two experts run per token. Don't size the GPU off the throughput you're expecting."
