---
description: A serverless configuration where requests enter a managed queue before a worker picks them up. Suits jobs, not conversations.
---

A [serverless endpoint](./Serverless%20endpoint.md) configuration where submitted requests go into a managed queue and are collected by [workers](./Worker.md) as capacity frees up. The client submits, receives a job identifier, and either polls for the result or waits on it.

The queue is doing real work here, not just buffering. It absorbs bursts without dropping them, holds requests while [autoscaling](./Autoscaling.md) provisions more workers, and survives a worker dying mid-job so the work can be retried elsewhere. That makes it a good fit for anything where completion matters more than immediacy: batch generation, transcription, image and video work, document processing, and any job long enough that a client would not hold a connection open for it anyway.

It also makes the platform's [queue depth](./Queue%20depth.md) the natural scaling signal — the number of waiting jobs is a direct measure of how much capacity is missing, and it moves before latency does.

Where it fits less well is interactive chat. Submit-then-poll adds a round trip before generation begins, which is added to [TTFT](./TTFT.md), and polling is an awkward shape for token-by-token [streaming](./Streaming.md). For a conversational product where the user is watching output appear, a [load-balancing endpoint](./Load-balancing%20endpoint.md) routes directly to a worker and holds one connection open, which is what streaming wants.

The dividing question is whether anyone is waiting on the response as it is produced. If the result is collected later, queue. If it is read as it arrives, route directly.

_Usage:_

"Chat responses feel laggy even though generation is fast."

"You're on a queue-based endpoint — submit, poll, then stream. For interactive traffic use load balancing so the connection goes straight to the worker."
