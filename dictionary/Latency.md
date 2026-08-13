---
description: How long an operation takes. For inference it decomposes into stages, and knowing which one dominates is what makes it fixable.
---

How long an operation takes. On its own the word is too coarse to act on, because an inference request's total time is the sum of several stages with different causes and different fixes.

| Stage      | What it is                | What it scales with                                      | How to reduce it                                                                   |
| ---------- | ------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Queue      | Waiting for capacity      | [Concurrency](./Concurrency.md) above what memory allows | More [KV cache capacity](./KV%20cache%20capacity.md), more [workers](./Worker.md)  |
| Scheduling | Waiting to join a batch   | Engine scheduling policy                                 | [Continuous batching](./Continuous%20batching.md)                                  |
| Prefill    | Processing the input      | Prompt length                                            | [Prefix caching](./Prefix%20caching.md), [chunked prefill](./Chunked%20prefill.md) |
| Decode     | Generating the output     | Output length                                            | [Memory bandwidth](./Memory%20bandwidth.md), [quantization](./Quantization.md)     |
| Network    | Client to server and back | Distance, payload                                        | Region placement                                                                   |
| Cold start | Provisioning a new worker | Whether one was warm                                     | [Scale to zero](./Scale%20to%20zero.md) settings, [FlashBoot](./FlashBoot.md)      |

End-to-end latency is all of these together. Splitting it is what makes a slow deployment diagnosable: a request that is slow because of queueing needs different treatment entirely from one that is slow because the prompt is long, and both look identical from the client.

Under [streaming](./Streaming.md) the total stops being the number that matters, because the user starts reading before it elapses. The pair that describes the experience is [TTFT](./TTFT.md), covering everything up to the first token, and [TPOT](./TPOT.md) for the pace after that.

Latency also trades against [throughput](./Throughput.md). Larger batches make better use of the [GPU](./GPU.md) and make each request slightly slower. Which one to favour is a product decision, not a technical one.

_Avoid:_ quoting a latency figure without a percentile. An average hides exactly the requests users complain about — see [tail latency](./Tail%20latency.md).

_Usage:_

"Latency went up 40% this week."

"Which part? If it's TTFT the prompts got longer or you're queueing. If it's the inter-token gap, that's batch pressure. Different fixes."
