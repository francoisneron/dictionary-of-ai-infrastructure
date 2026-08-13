---
description: Model weights stored near the compute so workers don't re-download them. Usually the largest single cold start saving available.
---

Model files kept somewhere a starting [worker](./Worker.md) can read them quickly, rather than downloaded from a public hub each time. Depending on the platform this is local NVMe on the host, a [network volume](./Network%20volume.md), or a provider-managed cache close to the GPUs.

The saving is large because the alternative is so slow. Pulling 140 GB of [model weights](./Model%20weights.md) from a public registry takes minutes at best and is subject to rate limits and outages you do not control. Reading the same files from local NVMe is bounded by storage bandwidth — gigabytes per second — and reading them from a well-placed network volume sits between the two. On most deployments this is the single largest lever on [cold start](./Cold%20start.md).

The tiers differ in a way worth being explicit about. Local disk is fastest and is lost when the instance goes away, so the first worker on a fresh machine pays full price and later ones on that machine do not. A network volume survives instances but is shared, so its throughput is divided among everyone reading at once — twenty workers starting simultaneously will not each see full bandwidth, which is exactly the moment [autoscaling](./Autoscaling.md) creates.

Two operational notes. Cache by content or by an immutable revision rather than by a mutable tag, so a model update produces a new entry instead of a stale hit. And remember the cache only removes the download; [model load time](./Model%20load%20time.md) — reading the weights into [VRAM](./VRAM.md) and any engine compilation — still has to happen, and on a well-cached deployment it becomes the dominant remaining cost.

_Usage:_

"We put the weights on a network volume and cold starts are still two minutes."

"That removed the download. What's left is loading 140 gigs into VRAM plus graph capture — the cache can't help with that part."
