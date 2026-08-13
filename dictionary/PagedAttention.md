---
description: Allocating the KV cache in small fixed blocks instead of one contiguous reservation per request. Recovers most of the wasted memory.
---

A memory management technique for the [KV cache](./KV%20cache.md) that allocates it in small fixed-size blocks rather than as one contiguous region per request. Introduced by [vLLM](./vLLM.md) and since adopted almost everywhere.

The problem it solves is waste, not speed. Engines used to reserve cache for each request sized to the maximum sequence it might reach — if the [context window](./Context%20window.md) allowed 4,096 [tokens](./Token.md), each request reserved 4,096 tokens of [VRAM](./VRAM.md) whether it used them or not. A request that generated 200 tokens held 95% of its reservation empty, multiplied across every concurrent request. Measurements at the time put usable cache utilization around 20 to 40 percent.

Blocks fix that the way an operating system's virtual memory does. The cache is carved into uniform blocks of a few tokens each, a request is handed blocks as it grows, and a per-request block table maps logical positions to wherever those blocks physically sit. Nothing needs to be contiguous, so a request holds only what it has actually used, and memory fragmentation — previously a real source of [OOM](./OOM.md) — largely disappears.

The recovered memory is the point: it becomes [KV cache capacity](./KV%20cache%20capacity.md), which becomes [concurrency](./Concurrency.md), which becomes [throughput](./Throughput.md). Paging also makes two other things cheap. [Prefix caching](./Prefix%20caching.md) works by letting several requests point at the same physical blocks for a shared prompt beginning, and [eviction](./KV%20cache%20eviction.md) becomes a matter of reclaiming individual blocks rather than whole requests.

_Usage:_

"Is PagedAttention something we need to turn on?"

"It's the default in any current engine. The thing to know is that it's why your effective concurrency is several times what naive reservation would give you."
