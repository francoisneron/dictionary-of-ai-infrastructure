---
description: The delay before a newly created worker can serve. Minutes for GPU inference, which is what makes scale to zero a real trade.
---

The delay between deciding a new [worker](./Worker.md) is needed and that worker being able to serve a request. For ordinary web services it is seconds; for GPU inference it is routinely minutes, and that difference shapes most scaling decisions.

It decomposes, and knowing which part dominates is what makes it addressable:

| Stage           | Typical  | How to cut it                                                                                       |
| --------------- | -------- | --------------------------------------------------------------------------------------------------- |
| Provisioning    | 10–60s   | Keep a worker warm; more flexible GPU choice                                                        |
| Image pull      | 10s–5min | Keep [model weights](./Model%20weights.md) out of the [container image](./Container%20image.md)     |
| Weight download | 0–10min  | [Model cache](./Model%20cache.md) or [network volume](./Network%20volume.md)                        |
| Load into VRAM  | 20s–2min | [Quantization](./Quantization.md); faster storage — see [model load time](./Model%20load%20time.md) |
| Engine init     | 5s–3min  | Skip graph capture or compilation if startup matters more                                           |
| First request   | seconds  | Warm it before marking ready                                                                        |

Two consequences follow. [Autoscaling](./Autoscaling.md) cannot be purely reactive, because capacity requested when the queue grows arrives after the spike — scaling has to be early, or a warm worker has to absorb the gap. And cold starts land squarely in [tail latency](./Tail%20latency.md): a deployment with a good median and a p99 measured in seconds is usually looking at the requests that arrived while a worker was booting.

The underlying decision is [idle cost](./Idle%20cost.md) against startup latency. Paying for a worker that mostly sits idle removes cold starts from the user's experience; [scale to zero](./Scale%20to%20zero.md) removes the cost and guarantees the first user after a quiet period waits. Platforms mitigate rather than eliminate this — Runpod's [FlashBoot](./FlashBoot.md) is one such mechanism.

_Usage:_

"p50 is 400ms and p99 is 45 seconds."

"Those are cold starts, not slow inference. Either keep one worker always on, or work through the stages — the image pull is usually the easiest win."
