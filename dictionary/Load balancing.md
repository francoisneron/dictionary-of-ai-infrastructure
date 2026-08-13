---
description: Choosing which worker serves each request. Round-robin is wrong for inference, because requests vary enormously in cost.
---

Distributing incoming requests across the available [workers](./Worker.md) behind an [endpoint](./Endpoint.md). Simple in principle, and the naive strategy is a genuinely poor fit for inference.

Round-robin and random assignment assume requests cost roughly the same. Inference requests do not: one is 200 [tokens](./Token.md) in and 50 out, the next is 30,000 in and 2,000 out, and the second occupies a worker's [KV cache](./KV%20cache.md) and compute for orders of magnitude longer. Spreading requests evenly by count therefore spreads load very unevenly, and some workers sit at their [KV cache capacity](./KV%20cache%20capacity.md) while others idle.

Better strategies route on state rather than on turn. Least-outstanding-requests sends work to whichever worker has the fewest in flight, which tracks actual occupancy. Engines that report their own queue and cache pressure allow routing on that directly, which is better still — a readiness [health check](./Health%20check.md) that reports real admission capacity, rather than merely that the process is up, is what makes this possible. The general principle is that the load balancer should ask how busy a worker is rather than how many requests it has been sent.

Two inference-specific considerations complicate it further. [Prefix caching](./Prefix%20caching.md) is per worker, so routing requests that share a prefix to the same worker turns a miss into a hit — a real gain that pure load-based routing throws away, and the reason prefix-aware routing exists. And [streaming](./Streaming.md) means connections are long-lived, so a balancer that assumes short requests will hold connections open in ways it did not expect.

Where load balancing cannot help is when every worker is genuinely full. At that point the answer is [autoscaling](./Autoscaling.md) or [backpressure](./Backpressure.md), not smarter distribution.

_Usage:_

"One worker keeps OOMing while the others look fine."

"Round-robin is sending it long requests by chance. Switch to least-outstanding — count-based balancing doesn't reflect what a request actually costs."
