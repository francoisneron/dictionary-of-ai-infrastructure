---
description: How long it takes to get weights from storage into VRAM and the engine ready. The part of a cold start caching cannot remove.
---

The time between a [worker](./Worker.md) having the [model weights](./Model%20weights.md) available and being able to serve a request. It covers reading the files from storage, moving them into [VRAM](./VRAM.md), and whatever initialization the [inference engine](./Inference%20engine.md) performs before it will accept work.

It is worth separating from the download it is often confused with. A [model cache](./Model%20cache.md) or [network volume](./Network%20volume.md) removes the transfer over the internet; model load time is what remains, and on a well-cached deployment it becomes the dominant part of the [cold start](./Cold%20start.md). Understanding which of the two you are paying determines whether faster storage helps at all.

Three things make it up. Reading the weights is bounded by storage throughput — 140 GB from NVMe at several GB/s is tens of seconds, from a shared volume considerably longer. Transferring into VRAM is bounded by PCIe. Then the engine initializes: allocating the [KV cache](./KV%20cache.md) pool, warming kernels, and often capturing CUDA graphs or compiling, which for something like TensorRT-LLM can dominate everything else. Engines that do more work here start slower and then serve faster, which is a good trade for long-lived workers and a bad one for [scale to zero](./Scale%20to%20zero.md).

The levers are the obvious ones plus one that is often overlooked: a smaller model loads faster. [Quantization](./Quantization.md) to FP8 halves the bytes to read and transfer, so it cuts load time roughly in half as a side effect of the memory saving it was chosen for.

_Usage:_

"Weights are on local NVMe now and it still takes 90 seconds before it serves."

"That's engine init, not the read. Graph capture and cache allocation happen after the load — check whether you need it before profiling storage further."
