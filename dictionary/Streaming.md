---
description: Sending tokens to the client as they are generated. Changes perceived speed without changing throughput at all.
---

Returning generated [tokens](./Token.md) to the client as they are produced rather than waiting for the complete response. The connection stays open and each token is pushed as [decode](./Decode.md) emits it, usually over server-sent events.

It changes what the user waits for, and nothing else. Without streaming, the wait is the whole response: [prefill](./Prefill.md) plus every token of generation, which for a long answer is many seconds of blank screen. With streaming, the wait is [TTFT](./TTFT.md) alone, and after that text arrives continuously at the rate given by [TPOT](./TPOT.md). Total time is identical. Perceived speed is not remotely identical, which is why interactive products stream by default.

Streaming also changes which metrics matter. Once output is visible as it arrives, end-to-end latency stops describing user experience and the pair of TTFT and TPOT starts. It is worth noting that a fast average with occasional long stalls feels worse than a uniformly slower stream, so the [tail](./Tail%20latency.md) of inter-token gaps deserves attention rather than just the mean. Those stalls usually come from another request's long prefill occupying the GPU, which is the problem [chunked prefill](./Chunked%20prefill.md) addresses.

Operationally it has costs. Connections are long-lived, so [timeouts](./Timeout.md), proxies and load balancers all need configuring for it, and a client that disconnects mid-stream should cancel the request rather than leaving it generating into nothing — otherwise it keeps consuming [KV cache](./KV%20cache.md) and a [worker](./Worker.md) slot for no one.

_Usage:_

"Users say it feels slow, but our p50 latency is fine."

"Are you streaming? If they're waiting for the full response, they're feeling total generation time. Stream it and they wait for the first token instead."
