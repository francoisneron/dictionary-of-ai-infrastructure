---
description: Runpod's cold start reduction, retaining reusable worker state so a restart is not a full boot. Narrows the trade, doesn't remove it.
---

[Runpod](./Runpod.md)'s mechanism for reducing [cold start](./Cold%20start.md) latency on [serverless endpoints](./Serverless%20endpoint.md), by retaining reusable state from recently-run [workers](./Worker.md) so that starting one again is not a boot from nothing.

The reasoning behind it is that most of a cold start is repeated work. Pulling the same [container image](./Container%20image.md), reading the same [model weights](./Model%20weights.md) off storage, and loading the same bytes into [VRAM](./VRAM.md) happens identically every time a worker for a given endpoint starts. Keeping that state warm and reusing it means a restart skips the parts that would produce a byte-for-byte identical result. A related idea applies to the weights themselves: a cached model kept close to the compute removes the download, which is often the largest single component — see [model cache](./Model%20cache.md).

It is worth being precise about what this does and does not change. FlashBoot shortens the cold start; it does not eliminate it, and it helps most when an endpoint has run recently enough for retained state to still exist. An endpoint idle for a long stretch, or one scaling into fresh capacity, is closer to a full start. So the underlying trade that [scale to zero](./Scale%20to%20zero.md) describes — [idle cost](./Idle%20cost.md) against startup latency — is narrowed rather than removed, and an [active worker](./Active%20worker.md) remains the way to remove it outright.

The complementary work is on your side of the line. An image without weights baked in, weights on fast storage, and an [inference engine](./Inference%20engine.md) not doing lengthy compilation at startup all shorten what has to happen regardless of platform help.

_Usage:_

"FlashBoot is on and cold starts are still 40 seconds."

"It skips the repeated parts, not the whole thing. Check what your image weighs and whether the engine is capturing graphs at startup — that's on your side."
