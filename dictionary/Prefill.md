---
description: The stage that processes input tokens. Compute bound, parallel across the whole prompt, and what time to first token measures.
---

The first stage of a request, where the model processes every input [token](./Token.md) and builds the [KV cache](./KV%20cache.md) entries for them. It ends when the first output token appears, which makes it the thing [TTFT](./TTFT.md) is measuring.

Prefill can process the entire prompt at once, because all of the input is already known. That gives the [GPU](./GPU.md) a large matrix multiplication with plenty of parallel work, which saturates the arithmetic units and makes prefill [compute bound](./Compute%20bound.md). Its cost grows with prompt length: doubling the prompt roughly doubles prefill time, so long-context requests are slow to start even when they generate quickly afterwards.

[Decode](./Decode.md), the stage that follows, behaves the opposite way in nearly every respect:

|                  | Prefill                    | Decode                                      |
| ---------------- | -------------------------- | ------------------------------------------- |
| Processes        | The whole prompt at once   | One token at a time                         |
| Parallelism      | High — all tokens together | Low — inherently sequential                 |
| Bottleneck       | Arithmetic                 | [Memory bandwidth](./Memory%20bandwidth.md) |
| Scales with      | Input length               | Output length                               |
| Metric it drives | TTFT                       | [TPOT](./TPOT.md)                           |

The two stages competing for the same GPU is a live scheduling problem rather than a theoretical one. A long prefill arriving mid-batch stalls everyone else's generation, which users experience as output that stutters for reasons unrelated to their own request. [Chunked prefill](./Chunked%20prefill.md) is the standard answer: break the prompt into pieces so prefill and decode interleave. [Prefix caching](./Prefix%20caching.md) attacks it from the other side, skipping prefill entirely for the portion of a prompt that has been seen before.

_Usage:_

"First token takes four seconds, then it's quick."

"That's prefill. Your prompts are long and it processes all of them before it can start. If they share a system prompt, turn on prefix caching."
