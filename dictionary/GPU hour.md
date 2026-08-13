---
description: The price of running one GPU for one hour. The number every provider advertises and the one that decides least on its own.
---

The cost of one [GPU](./GPU.md) running for one hour. It is the headline figure on every provider's pricing page, and by itself it tells you almost nothing about what inference will cost.

The reason is that it prices time, not work. What you are actually buying is [tokens](./Token.md), and how many tokens an hour of a given GPU produces varies by several times depending on the card, the model, the [inference engine](./Inference%20engine.md), the [quantization](./Quantization.md), and the [workload shape](./Workload%20shape.md). Dividing the hourly rate by measured [throughput](./Throughput.md) gives [cost per million tokens](./Cost%20per%20million%20tokens.md), which is the number that survives comparison — and it regularly ranks providers differently from the hourly rate, which is the point of computing it.

Billing granularity matters separately from the rate. Dedicated instances bill by the hour or minute for as long as they exist, whether or not they are serving anything, so anything below constant use pays [idle cost](./Idle%20cost.md). Serverless platforms bill by the second of actual execution, which changes the arithmetic for intermittent traffic — a workload running two hours a day can cost roughly a twelfth of an always-on instance, at the price of a [cold start](./Cold%20start.md) when it wakes.

Comparing options on that basis rather than on the sticker rate is what [price performance](./Price%20performance.md) means in practice. Cheaper hourly rates also often carry conditions worth pricing in: interruptible or spot capacity that can be reclaimed, older interconnects that make [tensor parallelism](./Tensor%20parallelism.md) slower, or regions far from your users. None of those show up in the hourly figure.

_Usage:_

"This provider is $1.80 an hour and ours is $2.40. Why aren't we moving?"

"Measure tokens per second on both first. If ours does twice the throughput, it's cheaper per million tokens despite the higher hourly rate."
