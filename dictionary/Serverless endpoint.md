---
description: A Runpod API backed by workers created on demand and removed when idle. Billed by execution rather than by the hour.
---

An API-facing resource on [Runpod](./Runpod.md) backed by [workers](./Worker.md) that are created when there is demand and removed when there is not. Serverless here means the usual thing: you define what a worker runs and the platform decides how many exist.

The billing model is what distinguishes it from a [Pod](./Pod.md). You pay for execution time rather than for a reserved machine, so an endpoint receiving no traffic can cost nothing at all. For workloads that are intermittent — internal tools, early products, anything following office hours — this removes the [idle cost](./Idle%20cost.md) that otherwise makes GPU inference expensive out of proportion to its use.

What you accept in return is [cold start](./Cold%20start.md). When no worker is running, the first request waits for one to be provisioned, pull its [container image](./Container%20image.md), and load the [model weights](./Model%20weights.md) into [VRAM](./VRAM.md). [FlashBoot](./FlashBoot.md) reduces this by retaining reusable state, and an [active worker](./Active%20worker.md) removes it entirely at the cost of one always-on GPU, which is the standard compromise.

Configuration is mostly about bounding [autoscaling](./Autoscaling.md): max workers caps how far it can scale out, GPUs per worker sets how many cards each one gets — more than one when [tensor parallelism](./Tensor%20parallelism.md) is needed — and an idle timeout decides how long a worker survives without traffic before being reclaimed. Two request models are available, [queue-based](./Queue-based%20endpoint.md) and [load-balancing](./Load-balancing%20endpoint.md), and they suit different kinds of work.

_Usage:_

"The endpoint costs nothing overnight, which is great, but the first morning request takes four minutes."

"That's the trade you accepted. Add one active worker — you'll pay for a single GPU around the clock and nobody waits for a boot."
