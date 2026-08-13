---
description: A serverless configuration routing requests straight to an available worker over one connection. What interactive streaming needs.
---

A [serverless endpoint](./Serverless%20endpoint.md) configuration where requests are routed directly to an available [worker](./Worker.md) and served over a single open connection, rather than being submitted to a queue and collected later.

It exists for interactive traffic. Because the connection stays open for the life of the request, [streaming](./Streaming.md) works naturally — tokens are pushed as [decode](./Decode.md) produces them, and the client renders them as they arrive. There is no submit-then-poll round trip inflating [TTFT](./TTFT.md), which matters when the whole user experience is how quickly text starts appearing. This is the configuration a chat product or a coding assistant wants, and it is also what makes an [OpenAI-compatible API](./OpenAI-compatible%20API.md) behave the way clients expect.

The cost of directness is less absorption. A queue can hold a burst indefinitely while capacity arrives; direct routing has to place each request on a worker now, so a spike that outruns [autoscaling](./Autoscaling.md) turns into rejections or waiting rather than into a growing backlog. [Backpressure](./Backpressure.md) becomes something to configure rather than something the queue handles implicitly, and keeping an [active worker](./Active%20worker.md) matters more, since there is nowhere for requests to sit while one boots.

[Load balancing](./Load%20balancing.md) across workers is also doing more work here than a queue-based setup requires, because it has to choose a destination rather than letting workers pull when free — which is where request cost variance starts to matter.

_Usage:_

"Which endpoint type for the assistant?"

"Load balancing. You're streaming to someone watching the screen, so you want a direct connection and no polling round trip in front of it."
