---
description: Time to first token. Everything before generation starts — queueing, scheduling and prefill — and what interactivity feels like.
---

**Time to first token.** The delay between sending a request and receiving the first generated [token](./Token.md). Under [streaming](./Streaming.md) it is the only wait a user actually experiences before text starts appearing, which makes it the headline metric for anything interactive.

It is a sum rather than a single thing, and that is what makes it diagnosable. TTFT covers network time out, any time spent in the queue waiting for capacity, the scheduling delay before the request joins a batch, and then [prefill](./Prefill.md) over the whole prompt. If a [worker](./Worker.md) had to be provisioned it also includes the entire [cold start](./Cold%20start.md), which is why the first request after an idle period can be seconds slower than every one after it.

Which component dominates tells you what to fix. TTFT that scales with prompt length is prefill, and the answers are [prefix caching](./Prefix%20caching.md) when requests share a beginning, or a card with more arithmetic. TTFT that scales with traffic rather than prompt size is queueing, which means [concurrency](./Concurrency.md) is above what [KV cache capacity](./KV%20cache%20capacity.md) supports and requests are waiting for memory. TTFT that is fine at [p50](./Tail%20latency.md) and terrible at p99 usually means occasional cold starts or occasional very long prompts.

Note that raising [batch size](./Batch%20size.md) to improve [throughput](./Throughput.md) generally worsens TTFT, since a new request waits longer for its turn. That trade is the central tuning decision in interactive serving.

_Usage:_

"Median TTFT is 300ms but p99 is 9 seconds."

"That's cold starts. Your p99 requests are landing on workers that had to boot — either keep one warm or cut the model load time."
