---
description: The packaged filesystem a worker starts from. Keep model weights out of it, or every cold start pays to download them.
---

The packaged filesystem and configuration a [worker](./Worker.md) is created from — the [inference engine](./Inference%20engine.md), its Python environment, CUDA libraries, and the entrypoint that starts serving. Built from a Dockerfile, stored in a registry, and pulled onto a machine before the worker can start.

The decision that matters is what goes inside. Baking [model weights](./Model%20weights.md) into the image is tempting because it makes the worker self-contained, and it is usually wrong: a 140 GB model produces a 140 GB image that has to be pulled over the network every time a worker starts on a machine that does not already have it. That pull is often the largest single component of a [cold start](./Cold%20start.md). Keeping weights out and reading them from a [model cache](./Model%20cache.md) or a [network volume](./Network%20volume.md) leaves an image of a few gigabytes that pulls quickly and is cached on the host after the first time.

Image layers reward ordering. Layers are cached individually and invalidated from the first change downward, so putting rarely-changed things first — base image, CUDA, dependencies — and frequently-changed things last means a code change re-pulls a small layer rather than the whole image. GPU images are large enough that this is worth doing deliberately.

Configuration comes in at runtime rather than build time. Environment variables carry model paths, [tensor parallelism](./Tensor%20parallelism.md) degree, and cache sizing; secrets such as API keys are injected by the platform rather than built in, since anything in a layer is readable by anyone who can pull the image.

_Usage:_

"Cold starts are eight minutes and most of it is before the model even starts loading."

"Your image has the weights in it. Pull them from a network volume instead — the image drops to two gigs and most of that eight minutes disappears."
