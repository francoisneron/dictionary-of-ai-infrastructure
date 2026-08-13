---
description: Money spent on capacity that is running but not working. Usually the largest avoidable line in a GPU bill.
---

What you pay for compute that is provisioned but not doing useful work. On GPU infrastructure it is frequently the largest avoidable item in the bill, because the hardware is expensive and most traffic is uneven.

The arithmetic is unforgiving. A [GPU hour](./GPU%20hour.md) is billed whether the card is [saturated](./Saturation.md) or idle, so an endpoint serving a busy eight-hour weekday pays for 168 hours a week and uses 40. Traffic that follows office hours, or that is internal, or that is early-stage and sparse, can easily spend most of its budget on hardware waiting for requests. The [utilization](./GPU%20utilization.md) figure people watch does not capture this — it describes the card while a [worker](./Worker.md) exists, not the hours the worker existed with nothing to do.

Reducing it means matching capacity to demand more closely. [Autoscaling](./Autoscaling.md) removes workers when traffic falls; [scale to zero](./Scale%20to%20zero.md) removes the last one and takes idle cost to nothing. Both trade against [cold start](./Cold%20start.md), which is the real decision: whether the money saved is worth the users who wait. A minimum of one warm worker is the usual compromise, capping idle cost at a single GPU while keeping [latency](./Latency.md) predictable — that one GPU is buying tail latency, and it is worth naming it that way rather than treating it as waste.

Note that idle cost hides in more than compute. A [network volume](./Network%20volume.md) is billed for allocated capacity continuously, whether or not anything is reading it, so oversized storage is idle cost that no autoscaling policy will ever reclaim.

_Usage:_

"The bill is four times what the traffic suggests it should be."

"Check how many hours those workers existed against how many they served. If it's an internal tool, you're paying overnight and at weekends for nothing."
