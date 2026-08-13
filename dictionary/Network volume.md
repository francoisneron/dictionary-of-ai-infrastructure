---
description: Storage that outlives the instance using it, reachable over the network. Where model weights belong, with shared-bandwidth caveats.
---

Persistent storage attached over the network rather than physically to one machine, so its contents survive the [workers](./Worker.md) that use it and can be mounted by several at once. Runpod's Network Volume is one instance of a general pattern.

The distinction that governs its use is persistence. Storage local to an instance is ephemeral: fast, but gone the moment the instance is destroyed, which for autoscaled GPU workloads is constantly. A network volume persists independently, which makes it the natural home for [model weights](./Model%20weights.md) — download once, mount everywhere, and every subsequent [cold start](./Cold%20start.md) skips the download entirely. It is also where a [model cache](./Model%20cache.md) shared across workers usually lives.

The trade is bandwidth, and it bites at the worst moment. A network volume's throughput is shared among everything reading it, so the numbers that look fine for one worker do not hold when [autoscaling](./Autoscaling.md) starts twenty at once and each tries to read 140 GB. Effective per-worker bandwidth collapses and cold starts stretch well past what a single-worker test suggested. Local NVMe, where available, is faster but has to be populated per machine.

Two constraints follow from it being a network resource. It generally lives in one region or data center, so [workers](./Worker.md) scheduled elsewhere cannot mount it — which quietly restricts where capacity can come from when your preferred GPUs are scarce. And it is billed for what is allocated, continuously, whether or not anything is running, so an oversized volume is a form of [idle cost](./Idle%20cost.md).

_Usage:_

"One worker starts in 90 seconds, but when we scale to ten it's five minutes each."

"They're all reading the same volume at once and splitting its bandwidth. Either stagger the scale-out or get the weights onto local disk."
