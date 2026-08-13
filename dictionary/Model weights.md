---
description: The learned numbers that make up a trained model. They occupy most of a deployment's VRAM and are what you actually download.
---

The learned numerical values that make up a trained model. They occupy most of the [VRAM](./VRAM.md) a deployment needs, and they are what you are actually downloading when you pull a model from a hub.

A published model is a directory rather than a single file. It holds the weights split across several shards, a config file describing the architecture, and the [tokenizer](./Tokenizer.md) files needed to turn text into [tokens](./Token.md). Hugging Face is where most of this is distributed. The shards are usually safetensors, a format designed to be memory-mapped and loaded without executing arbitrary code — the older alternative, pickled PyTorch checkpoints, can run code on load. GGUF is a different packaging used mainly by llama.cpp-style runtimes, bundling quantized weights and metadata into a single file.

Size on disk follows directly from [parameter count](./Parameter%20count.md) and [precision](./Precision.md): bytes per parameter times the number of parameters. A 70B model at BF16 is around 140 GB; the same model at INT4 is around 35 GB. That number sets the floor of the [VRAM budget](./VRAM%20budget.md), and it is also what you pay for in download time every time a [worker](./Worker.md) starts without a [model cache](./Model%20cache.md) to read from.

Weights are read-only during inference. Every request runs against the same bytes, which is why one loaded copy can serve many requests at once, and why [data parallelism](./Data%20parallelism.md) means paying the whole memory cost again for each replica.

_Usage:_

"Why is the container image ninety gigabytes?"

"It's baking the model weights into the image. Pull them onto a network volume instead and the image drops to a couple of gigs — and your cold starts stop being dominated by the registry."
