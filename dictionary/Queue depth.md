---
description: How many requests are waiting rather than running. The earliest honest signal that capacity is short.
---

The number of requests waiting for capacity rather than being processed. A queue sits behind every [endpoint](./Endpoint.md), holding work when the [workers](./Worker.md) cannot accept more, and its depth is the most direct measurement of whether capacity matches demand.

It is the best early-warning signal available, because it moves before anything else does. A queue that is empty means spare capacity. A queue that is short and stable means demand and capacity are matched. A queue that is growing means arrivals exceed completions, and the important property of that state is that it does not stabilize on its own — every second of it adds waiting time to every subsequent request. [Latency](./Latency.md) climbs, but it climbs after the queue has already told you.

Depth translates into wait time by way of completion rate: a queue of 40 in front of a service completing 10 requests per second means a 4-second wait before a request even starts, added to its [TTFT](./TTFT.md). This is why a deployment can show healthy per-request timings and terrible user-visible latency at the same time, and why queue depth belongs on a dashboard next to [GPU utilization](./GPU%20utilization.md) rather than behind it.

Some queueing is deliberate and good. It absorbs bursts and keeps workers fed, which is why [autoscaling](./Autoscaling.md) usually reacts to queue depth rather than to utilization. Persistent growth is not absorbable and needs either more workers or [backpressure](./Backpressure.md) to shed load. A queue with no bound is the worst arrangement: it accepts everything, delivers everything late, and the requests it eventually serves have often already been abandoned — the distinction [goodput](./Goodput.md) draws.

_Usage:_

"Latency is up but the GPUs aren't maxed out."

"Look at queue depth. If it's growing, requests are waiting on KV cache room, not on compute — utilization won't show you that."
