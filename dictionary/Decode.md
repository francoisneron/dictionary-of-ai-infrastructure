---
description: The stage that generates output one token at a time. Memory bound, sequential, and what sets the pace of a streamed response.
---

The stage where the model generates output, one [token](./Token.md) at a time. Each token is produced, appended to the sequence, and fed back in to produce the next, until the model emits a stop token or hits a length limit.

Decode is sequential by construction — token 50 cannot be computed before token 49 exists. That makes it the opposite of [prefill](./Prefill.md) in how it uses hardware. There is almost no parallel work in a single request's decode step, so the [GPU](./GPU.md) spends its time reading the [model weights](./Model%20weights.md) out of [VRAM](./VRAM.md) rather than doing arithmetic. It is [memory bound](./Memory%20bound.md), and its speed is set by [memory bandwidth](./Memory%20bandwidth.md) rather than by compute.

That single fact explains most of the counterintuitive behavior in serving. Generating for one user leaves the GPU mostly idle, because the weights get read once per token no matter how many requests ride along. Batching many requests together amortizes that read across all of them, so [throughput](./Throughput.md) climbs steeply with [batch size](./Batch%20size.md) while per-user speed barely moves. It also explains why a smaller or [quantized](./Quantization.md) model generates faster: there are simply fewer bytes to move per token, and why [speculative decoding](./Speculative%20decoding.md) can work at all — the idle arithmetic capacity is already paid for.

Every decoded token adds to the [KV cache](./KV%20cache.md), so long generations grow their own memory footprint as they run. The user-visible pace of decode is [TPOT](./TPOT.md), and under [streaming](./Streaming.md) it is what a response feels like once it has begun.

_Usage:_

"One request runs at 40 tokens a second and the GPU reads 20% busy. Are we wasting the card?"

"Decode is memory bound, so yes — a single stream can't fill it. Batch more requests and throughput goes up several times over at roughly the same per-user speed."
