---
description: The point where more load stops buying throughput and only adds latency. Performance degrades sharply past it, not gradually.
---

The point at which additional load stops producing additional useful work. Below it, more [concurrency](./Concurrency.md) means more [throughput](./Throughput.md); above it, throughput is flat or falling while [latency](./Latency.md) climbs steeply.

The behaviour past that point is worth expecting, because it is not gradual. A service at 80% of capacity looks healthy and a service at 105% degrades fast, since the excess accumulates: arrivals exceed completions, [queue depth](./Queue%20depth.md) grows without bound, waiting time grows with it, clients begin to [time out](./Timeout.md) and retry, and the retries add load. The knee in the curve is sharp, which is why capacity headroom is worth paying for rather than optimizing away.

In inference, saturation has a specific and unusual first cause. On most services the limit is compute; here it is usually memory. Once in-flight requests exhaust [KV cache capacity](./KV%20cache%20capacity.md), the engine cannot admit more regardless of idle arithmetic capacity, so new requests queue and existing ones may face [eviction](./KV%20cache%20eviction.md). This is why a [saturated](./GPU%20utilization.md) inference deployment often shows unremarkable GPU utilization — the constraint was never compute.

Finding the point requires measurement, since it depends on the model, the hardware and the [workload shape](./Workload%20shape.md) together. A [concurrency sweep](./Concurrency%20sweep.md) plots throughput and latency against load, and the knee is visible directly. Configure limits below it, use [backpressure](./Backpressure.md) to hold the line, and let [autoscaling](./Autoscaling.md) add [workers](./Worker.md) rather than letting one absorb more than it can.

_Usage:_

"It was completely fine yesterday and today it's falling over. Traffic is only up 15%."

"You were just under the knee and now you're over it. Past saturation the queue grows without bound — the last 15% isn't costing 15%."
