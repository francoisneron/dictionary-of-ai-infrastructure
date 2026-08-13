---
description: The network address requests are sent to. The stable thing clients know about, decoupled from the workers behind it.
---

The network-addressable interface a client sends inference requests to. It is the stable public face of a deployment: a URL and a contract, usually an [OpenAI-compatible API](./OpenAI-compatible%20API.md), that stays constant while everything behind it changes.

The separation is the point. Behind one endpoint sit some number of [workers](./Worker.md), each running an [inference engine](./Inference%20engine.md) with the model loaded. That number changes as [autoscaling](./Autoscaling.md) responds to demand, individual workers fail and are replaced, and deployments roll out new versions. None of that is visible to the caller, which is what makes capacity a runtime concern rather than a client concern.

An endpoint also owns the behaviour that does not belong to any single worker. [Load balancing](./Load%20balancing.md) decides which worker gets a request. The queue holds requests when every worker is busy, and its [depth](./Queue%20depth.md) is the earliest signal that capacity is short. [Timeouts](./Timeout.md), retries and [backpressure](./Backpressure.md) policy live here too, along with authentication and per-client limits.

One endpoint generally means one model. Serving several models means several endpoints, each with its own workers holding its own [model weights](./Model%20weights.md) in [VRAM](./VRAM.md) — models are not cheap to swap, so an endpoint that had to load a different model per request would spend its life paying [model load time](./Model%20load%20time.md).

_Usage:_

"Do we need a separate endpoint for the summarizer?"

"If it's a different model, yes — one endpoint's workers hold one model in VRAM. Same model with a different system prompt is just a different request."
