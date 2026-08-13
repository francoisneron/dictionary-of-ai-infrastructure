---
description: A controlled measurement of performance. Only meaningful against a workload resembling yours, which published numbers rarely are.
---

A controlled test measuring how a deployment performs. The word covers several distinct exercises — a load test at expected traffic, a stress test pushed until things break, a comparison between two configurations — and they answer different questions.

The reason to run your own rather than trust a published figure is that inference performance depends on the [workload shape](./Workload%20shape.md) as much as on the hardware. A benchmark using 128-token prompts and 128-token outputs measures mostly [decode](./Decode.md) and rewards [memory bandwidth](./Memory%20bandwidth.md). One using 8,000-token prompts and 200-token outputs measures mostly [prefill](./Prefill.md) and rewards arithmetic. Two GPUs can trade places between those, so a number produced under someone else's traffic shape does not transfer to yours.

Getting a benchmark right is mostly about avoiding a few specific errors. Warm up first — the first requests pay [cold start](./Cold%20start.md), engine initialization and cache population, and including them measures startup rather than steady state. Measure at realistic [concurrency](./Concurrency.md), since single-request numbers tell you almost nothing about a batching system. Report percentiles rather than averages, because the [tail](./Tail%20latency.md) is where the problems are. And use realistic prompts: if production shares a system prompt, the benchmark should too, or [prefix caching](./Prefix%20caching.md) will make the test look worse than reality — and if it does not share one, a benchmark that repeats the same prompt will look far better.

The most useful single output is not a number but a curve, from a [concurrency sweep](./Concurrency%20sweep.md), showing where [throughput](./Throughput.md) flattens and [latency](./Latency.md) turns up. That is what tells you where to set limits.

_Usage:_

"The vendor benchmark says 3,000 tokens a second and we're seeing 600."

"What prompt lengths did they use? If they measured short prompts and yours are 8k, you're paying for prefill they never measured."
