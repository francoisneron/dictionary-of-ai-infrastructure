---
description: How much work a deployment completes per unit time — usually total tokens per second across every in-flight request.
---

How much work a deployment completes per unit of time. For inference this is usually total [tokens](./Token.md) per second across every in-flight request, and sometimes requests per second when request sizes are comparable.

Throughput and [latency](./Latency.md) are different questions, and they often move in opposite directions. Batching more requests together raises throughput substantially, because [decode](./Decode.md) is [memory bound](./Memory%20bound.md) and the [model weights](./Model%20weights.md) get read once for the whole batch instead of once per request. It also makes each individual request slightly slower. A configuration tuned purely for throughput has excellent aggregate numbers and unhappy users; one tuned purely for latency leaves most of the [GPU](./GPU.md) idle.

The number means nothing without the conditions that produced it. Tokens per second at [concurrency](./Concurrency.md) one and at concurrency 64 can differ by more than an order of magnitude on identical hardware, and prefill tokens and decode tokens cost very different amounts to produce. A throughput figure needs its [workload shape](./Workload%20shape.md) attached before it can be compared to anything, which is what a [concurrency sweep](./Concurrency%20sweep.md) exists to produce.

Throughput is also the denominator that turns an hourly rate into a real cost. A [GPU hour](./GPU%20hour.md) price on its own says nothing; price divided by tokens per second is [cost per million tokens](./Cost%20per%20million%20tokens.md), and that is the comparison that decides which card is actually cheaper. Pushing throughput past the point where latency targets break is measured by [goodput](./Goodput.md) instead.

_Avoid:_ quoting "tokens per second" without saying whether it is per request or aggregate, and at what concurrency. The two readings differ by the [batch size](./Batch%20size.md).

_Usage:_

"We're getting 2,000 tokens a second, that sounds healthy."

"At what concurrency, and how much of it is prefill? Aggregate throughput on long prompts isn't comparable to the number you measured last week."
