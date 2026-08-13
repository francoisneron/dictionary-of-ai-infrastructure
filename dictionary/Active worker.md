---
description: A worker deliberately kept running so requests skip the cold start. Buying predictable tail latency with one GPU's idle cost.
---

A [worker](./Worker.md) on a [serverless endpoint](./Serverless%20endpoint.md) that is deliberately kept running rather than being reclaimed when traffic stops. It is the floor of the [autoscaling](./Autoscaling.md) range: the minimum number of workers the platform maintains regardless of demand.

Its purpose is to remove the [cold start](./Cold%20start.md) from the path of the first request after a quiet period. On a pure [scale to zero](./Scale%20to%20zero.md) endpoint, that request waits for a worker to be provisioned and for the [model weights](./Model%20weights.md) to load — minutes, landing on whoever happened to arrive first. Keeping one worker alive means that request is served immediately, and additional workers scale up behind it as normal.

Seen honestly it is a purchase rather than a waste. You are paying one GPU's [idle cost](./Idle%20cost.md) continuously and receiving predictable [tail latency](./Tail%20latency.md) in return. Whether that is worth it comes down to arrival patterns: sparse traffic with long gaps means most requests would otherwise arrive cold, which makes an active worker excellent value; steady traffic keeps a worker alive anyway, which makes it redundant. The characteristic symptom of not having one is a good [p50](./Tail%20latency.md) alongside a p99 measured in tens of seconds.

Two related settings frame it. Max workers caps how far the endpoint may scale out — the ceiling on both capacity and spend. GPUs per worker sets how many cards each worker holds, which needs raising above one when the model requires [tensor parallelism](./Tensor%20parallelism.md) to fit or to leave usable [KV cache capacity](./KV%20cache%20capacity.md).

_Usage:_

"Can we get the p99 down without giving up serverless?"

"One active worker. You'll pay for a single GPU all the time, but the requests that were hitting cold starts get served immediately."
