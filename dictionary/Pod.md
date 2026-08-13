---
description: A dedicated Runpod instance you rent and hold. Billed for as long as it exists, whether or not it is doing anything.
---

A dedicated compute environment on [Runpod](./Runpod.md) — CPU, one or more [GPUs](./GPU.md), memory, storage and networking — that you create and keep until you stop it. A GPU Pod is simply one with GPUs attached, which is the usual case for inference work.

The defining property is that it is yours continuously. Nothing scales it down, nothing reclaims it between requests, and you are billed for the whole time it exists rather than for the work it does. That makes it the right shape for anything with a long-running or interactive relationship to the hardware: development and experimentation, fine-tuning, notebook work, batch jobs, and production serving with steady enough traffic to keep the card busy. It is the wrong shape for sparse traffic, where [idle cost](./Idle%20cost.md) is most of the bill and a [serverless endpoint](./Serverless%20endpoint.md) fits better.

Because a Pod persists, [cold start](./Cold%20start.md) is a one-time cost rather than a recurring risk. The [model weights](./Model%20weights.md) load once and stay in [VRAM](./VRAM.md) for the life of the instance, so [TTFT](./TTFT.md) has no startup component and [tail latency](./Tail%20latency.md) is not punctuated by workers booting. Local disk is ephemeral and disappears with the Pod, so anything worth keeping belongs on a [Network Volume](./Network%20volume.md).

GPU priority is worth knowing about when capacity is tight. Rather than requesting one specific card and waiting for it, you can give an ordered list of acceptable types, and the platform takes the highest available. Since specific GPUs are frequently unavailable, flexibility here is often the difference between starting now and queueing.

_Usage:_

"We spun up a Pod for the demo three weeks ago."

"Is it still running? A Pod bills until you stop it — that's three weeks of GPU whether anyone used it or not."
