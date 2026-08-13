---
description: A probe asking whether a worker is working. Conflating "alive" with "ready" is what makes deployments drop requests.
---

A probe that asks a [worker](./Worker.md) whether it is functioning, so the platform can decide whether to send it traffic or replace it. Inference deployments need to distinguish several questions that look similar and are not.

| Check     | Question                             | On failure                                                         |
| --------- | ------------------------------------ | ------------------------------------------------------------------ |
| Startup   | Has it finished loading yet?         | Keep waiting, don't kill it                                        |
| Readiness | Can it take traffic right now?       | Remove from [load balancing](./Load%20balancing.md), leave running |
| Liveness  | Is the process still working at all? | Kill and replace it                                                |

Collapsing these is the classic inference deployment failure, and it happens because [model load time](./Model%20load%20time.md) is long. A worker pulling a [container image](./Container%20image.md) and loading 140 GB of [model weights](./Model%20weights.md) can take minutes during which it answers nothing. A liveness probe with a short timeout concludes it is broken and kills it, the replacement starts loading from scratch, and the deployment never comes up. A generous startup probe, or a long initial delay, is the fix.

The other half is readiness. A worker at its [KV cache capacity](./KV%20cache%20capacity.md) is healthy but should not receive more work; one that is loading is alive but not ready. Readiness that reports actual admission capacity rather than merely "process running" is what lets a balancer route around pressure instead of piling onto it.

Make the check meaningful. A handler that returns 200 unconditionally proves the HTTP server is up and nothing about whether the model is loaded or the [GPU](./GPU.md) is present — a worker whose CUDA context has died will pass it happily and fail every real request.

_Usage:_

"New workers keep getting killed and restarted before they ever serve anything."

"Liveness probe is firing during model load. Add a startup probe with a timeout longer than your worst cold start, and don't let liveness run until it passes."
