---
description: Throughput that also meets your latency targets. The honest capacity number, since work delivered too late has no value.
---

The rate of work that is both completed and useful — [throughput](./Throughput.md) counted only where it satisfies the latency requirements attached to it. Requests served too slowly to matter are counted as capacity spent, not capacity delivered.

The distinction exists because raw throughput can always be increased by making everyone wait. Push [batch size](./Batch%20size.md) and [concurrency](./Concurrency.md) limits high enough and total tokens per second keeps climbing while [TTFT](./TTFT.md) stretches to ten seconds and [TPOT](./TPOT.md) falls below reading pace. The dashboard improves; the product gets worse. Goodput is what stops that trade from looking like a win.

Measuring it requires stating the targets first — for example, TTFT under one second and TPOT under 100ms — and then counting only the tokens from requests that met them. Plotted against concurrency, the two curves separate in a way that is immediately useful: throughput rises and then flattens, while goodput rises, peaks, and falls as the tail crosses the threshold. The peak of the goodput curve is the concurrency limit worth configuring, and it usually sits well below where throughput stops improving.

This is also the number that makes [saturation](./Saturation.md) concrete. Past the goodput peak, added load produces requests that are technically served and practically useless, plus a growing share of clients that give up and [retry](./Timeout.md), which adds still more load.

_Usage:_

"We can push to 128 concurrent before throughput flattens out."

"Throughput flattens there, but goodput peaked at 48 — past that you're serving requests slower than the SLA, so you're paying for work nobody accepts."
