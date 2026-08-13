---
description: Removing every worker when there is no traffic. Eliminates idle cost and guarantees the next user waits for a cold start.
---

Allowing an [endpoint](./Endpoint.md) to drop to no running [workers](./Worker.md) when there is no demand, and starting one when a request arrives. The defining property of serverless GPU infrastructure, and a genuine trade rather than a free optimization.

What it buys is straightforward: [idle cost](./Idle%20cost.md) goes to zero. GPUs are expensive by the hour, and a workload that runs for two hours a day spends the other twenty-two paying for hardware doing nothing. For intermittent traffic — internal tools, batch jobs, development environments, early products with sparse usage — this is often the difference between viable and not.

What it costs is that somebody experiences the full [cold start](./Cold%20start.md), which for GPU inference is minutes rather than milliseconds. Worse, it is not evenly distributed: it lands on whoever arrives first after a quiet period, which is disproportionately the person trying the product for the first time. It also lands unpredictably, showing up as a bad [tail latency](./Tail%20latency.md) rather than as a uniformly slower service.

Whether the trade works depends on traffic shape, and the question to ask is what fraction of requests arrive cold. Steady traffic keeps a worker alive and almost never pays; sparse, bursty traffic pays constantly. The middle ground is a minimum of one worker — an [active worker](./Active%20worker.md) in Runpod's terms — which caps idle cost at a single GPU while ensuring someone is always ready. Providers also blunt the edge with mechanisms like [FlashBoot](./FlashBoot.md) that retain reusable state so a restart is not a full boot.

The idle timeout before scaling down is the tuning dial: too short and you pay cold starts during ordinary gaps in traffic; too long and you are paying for idle capacity you meant to avoid.

_Usage:_

"Scale to zero saved us a fortune but users say it's unreliable."

"They're hitting cold starts after quiet periods. Keep one active worker — you'll pay for one GPU instead of zero, and nobody waits four minutes."
