---
description: Adding and removing workers as demand changes. Harder for GPUs, because a new worker takes minutes rather than seconds to arrive.
---

Adjusting the number of [workers](./Worker.md) behind an [endpoint](./Endpoint.md) automatically in response to demand. Scaling out adds workers, scaling in removes them; the intent is to pay for capacity roughly in proportion to use.

GPU inference makes this harder than ordinary web autoscaling in one specific way: the response is slow. A stateless web container starts in seconds, so reactive scaling works. A worker must be provisioned, pull a [container image](./Container%20image.md), and load tens of gigabytes of [model weights](./Model%20weights.md) — a [cold start](./Cold%20start.md) measured in minutes. By the time capacity arrives the spike may be over, and everything in between was served badly or not at all. GPU availability adds a second constraint that no amount of configuration fixes: the instance type you want may not exist right now.

Which signal to scale on matters. [GPU utilization](./GPU%20utilization.md) is the intuitive choice and a poor one, since a [memory bound](./Memory%20bound.md) [decode](./Decode.md) step reads as busy while the card is underused. [Queue depth](./Queue%20depth.md), or requests waiting per worker, tracks the thing that actually hurts and moves earlier.

Scaling in deserves as much thought as scaling out. Removing a worker mid-request drops in-flight work, so workers need to drain — stop accepting new requests, finish current ones, then exit — and [streaming](./Streaming.md) responses can hold connections open for minutes. Scale in on a longer delay than you scale out, because the cost of a premature removal is a cold start you then have to pay again.

The floor is the real decision. [Scale to zero](./Scale%20to%20zero.md) eliminates [idle cost](./Idle%20cost.md) and guarantees a cold start on the next request; a minimum of one keeps latency predictable and pays around the clock.

_Usage:_

"Autoscaling is on but every traffic spike still times out."

"Scaling on utilization, and a worker takes four minutes to load. Scale on queue depth and keep a warm one — reactive scaling can't outrun a cold start."
