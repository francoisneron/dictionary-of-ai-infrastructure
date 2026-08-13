---
description: The deadline for an operation. Hard to set for inference, because response time depends on output length nobody knows in advance.
---

The maximum time an operation is allowed before it is abandoned. Straightforward for most services and awkward for inference, because request duration varies by orders of magnitude for reasons no one can see in advance.

The difficulty is that response time is dominated by output length, and output length is not known until generation ends. A request that produces 50 [tokens](./Token.md) finishes in under a second; the same prompt producing 2,000 takes a minute. A single timeout has to accommodate the longest legitimate response, which makes it useless as a signal that anything is wrong — by the time it fires, a minute of [GPU](./GPU.md) time has already been spent.

[Streaming](./Streaming.md) offers a better instrument. With tokens arriving continuously, the useful deadline is not total duration but silence: a gap of several seconds between tokens genuinely indicates a stall, while a long-but-flowing response is fine. An idle timeout between tokens plus a generous overall ceiling detects real failures without penalising long answers. Capping maximum output tokens per request bounds the worst case directly, which is often the more effective control.

Retries are the other half and the more dangerous one. A timeout followed by an immediate retry doubles load exactly when a service is already struggling, and if many clients do it simultaneously the result is a retry storm that turns slowness into an outage. Retries need exponential backoff, jitter, and a cap. They should also be skipped entirely for a request already known to be expensive — retrying a 30,000-token prompt against a [saturated](./Saturation.md) service adds a large amount of work with a low chance of success. Cancelling on client disconnect matters for the same reason: an abandoned request still holds [KV cache](./KV%20cache.md) and a slot until it is stopped.

_Usage:_

"We set a 30-second timeout and now long generations fail."

"Use an inter-token idle timeout instead — a few seconds of silence is a real stall, but a two-minute answer streaming steadily is working fine."
