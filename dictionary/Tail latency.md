---
description: What the slowest requests experience. Averages hide it, and it is usually the number your users are actually complaining about.
---

The [latency](./Latency.md) experienced by the slowest portion of requests, described by percentiles rather than by an average. It is where most real complaints live, and it is invisible in a mean.

| Measure | Meaning                     | Who feels it                          |
| ------- | --------------------------- | ------------------------------------- |
| p50     | Half of requests are faster | The typical request. What demos show. |
| p95     | 1 in 20 is slower           | Noticeable to regular users           |
| p99     | 1 in 100 is slower          | Every heavy user, several times a day |
| p99.9   | 1 in 1,000 is slower        | Timeouts, retries, support tickets    |

The reason percentiles diverge under load is structural. Once [concurrency](./Concurrency.md) exceeds what [KV cache capacity](./KV%20cache%20capacity.md) supports, some requests run immediately and others wait, so the distribution grows a long right tail while the median barely moves. A dashboard showing average latency can look flat through exactly the period where a meaningful share of users are having a bad time.

Aggregation makes this worse in a specific way worth knowing: percentiles cannot be averaged. The mean of per-minute p99s is not the p99 of the hour, and it is systematically optimistic. Compute percentiles over the raw distribution.

In inference the tail usually has a small number of causes. [Cold starts](./Cold%20start.md) put whole seconds into a few requests. Unusually long prompts inflate [prefill](./Prefill.md) for themselves and stall the batch for others. Queueing at peak stretches everything. And [retries](./Timeout.md) against an already-saturated service add load precisely when it is least able to absorb it.

_Avoid:_ reporting an average latency at all when the distribution is skewed. Quote p50 and p99 together — the gap between them is the interesting number.

_Usage:_

"Average response time is 800ms, that's within target."

"What's p99? If it's twelve seconds, one request in a hundred is timing out and the average is telling you nothing about it."
