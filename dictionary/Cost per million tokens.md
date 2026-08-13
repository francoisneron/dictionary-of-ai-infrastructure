---
description: Infrastructure cost normalized to a million tokens. The unit that makes GPUs, providers and configurations actually comparable.
---

Infrastructure spend divided by [tokens](./Token.md) produced, scaled to a million. It is the unit that makes different hardware, providers and configurations comparable, because it prices work rather than time.

The calculation is hourly cost divided by measured [throughput](./Throughput.md), converted to a per-million rate. What makes it worth doing is how often it reverses the ranking that [GPU hour](./GPU%20hour.md) prices suggest:

|                      | GPU A     | GPU B     |
| -------------------- | --------- | --------- |
| Hourly rate          | $1.00     | $2.00     |
| Tokens per second    | 1,000     | 4,000     |
| Tokens per hour      | 3.6M      | 14.4M     |
| **Cost per million** | **$0.28** | **$0.14** |

GPU B costs twice as much per hour and half as much per token. Choosing on the hourly rate doubles the bill while feeling like a saving — which is the single most common costing mistake in this field.

Three things need care when computing it. Input and output tokens cost very different amounts to produce, since [prefill](./Prefill.md) processes the prompt in parallel while [decode](./Decode.md) emits one token at a time, so a blended rate only transfers between deployments with the same [workload shape](./Workload%20shape.md). The throughput figure must come from a realistic [concurrency](./Concurrency.md) level, because single-request numbers understate a batching system by a wide margin. And [idle cost](./Idle%20cost.md) belongs in the numerator: a card that bills 24 hours and serves 6 has four times the effective cost per token that a utilization-blind calculation shows.

Every efficiency lever elsewhere in this dictionary ultimately lands here. [Quantization](./Quantization.md), [prefix caching](./Prefix%20caching.md), [continuous batching](./Continuous%20batching.md) and right-sized [concurrency](./Concurrency.md) all raise tokens per hour against a fixed rate, which is the same thing as lowering this number.

_Usage:_

"Finance wants to know if self-hosting beats the API."

"Compute cost per million tokens at your real concurrency, including the hours the GPUs sit idle. Against list API prices it's usually close, and the idle hours decide it."
