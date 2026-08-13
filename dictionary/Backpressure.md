---
description: Rejecting or slowing work when a service is full. Failing fast beats accepting requests you will serve too late to matter.
---

Refusing or deferring incoming work when a service is at capacity, rather than accepting it and serving it late. The mechanism is usually a bounded queue: past a set [depth](./Queue%20depth.md), new requests are rejected with a 429 and a retry hint instead of being admitted.

The instinct to accept everything is the one worth arguing against. An unbounded queue does not add capacity, it converts a capacity shortage into a latency problem and hides it. Requests pile up, each one waits longer than the last, and the service eventually returns answers to clients that gave up seconds ago — work that consumed [KV cache](./KV%20cache.md), [GPU](./GPU.md) time and money while producing nothing, which is exactly the gap [goodput](./Goodput.md) measures.

It gets worse than merely wasteful. Clients that time out generally [retry](./Timeout.md), so the load that overwhelmed the service returns amplified, at the moment it is least able to absorb it. Backpressure breaks that loop by making the failure immediate and visible: a fast 429 lets a caller back off, queue the work itself, or degrade gracefully, and none of those are possible while it is still waiting hopefully.

Setting the threshold is a matter of arithmetic rather than taste. Given a completion rate and a latency target, the maximum useful queue depth is the number of requests that can still be served in time — anything beyond it is a request you have chosen to serve too late. Pair it with [autoscaling](./Autoscaling.md) so that sustained rejection triggers more [workers](./Worker.md), and treat the rejection rate as the signal that capacity is short.

_Usage:_

"Should we just let the queue grow during spikes instead of returning errors?"

"Then everyone waits and half of them have already left. Bound it — a fast 429 lets the caller retry sensibly instead of you burning GPU on abandoned work."
