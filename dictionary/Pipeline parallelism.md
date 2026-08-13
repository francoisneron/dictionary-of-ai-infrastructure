---
description: Splitting a model into sequential stages of layers, one per GPU. Cheap on communication, but stages idle unless kept fed.
---

Splitting a model's layers into consecutive stages and putting each stage on a different [GPU](./GPU.md). A request flows through stage one, is handed to stage two, and so on, with each card holding a contiguous block of layers rather than a slice of every layer.

Its advantage over [tensor parallelism](./Tensor%20parallelism.md) is how little it communicates. Data crosses between GPUs only at stage boundaries — three transfers for a four-stage split, rather than two per layer — and what crosses is a small activation tensor rather than a full synchronization. That makes pipeline parallelism viable where the interconnect is weak: across machines, over PCIe, anywhere [NVLink](./NVLink.md) is not available, which is exactly where tensor parallelism falls apart.

The weakness is idle time, usually called the pipeline bubble. Stage two cannot start on a request until stage one has finished with it, so with a single request in flight three of four GPUs are always waiting. Keeping the pipeline full requires enough concurrent requests to occupy every stage at once, which means pipeline parallelism raises [throughput](./Throughput.md) at high [concurrency](./Concurrency.md) and does nothing for the [latency](./Latency.md) of an individual request. Tensor parallelism is the opposite: it lowers single-request latency because every card works on the same [token](./Token.md).

That difference is what decides between them. Interactive serving at modest concurrency favours tensor parallelism inside a machine. Very large models that must span machines, or batch workloads with plenty of requests to keep every stage busy, favour pipeline parallelism — often with tensor parallelism used within each stage.

_Usage:_

"Pipeline parallel across four nodes and it's no faster per request."

"It won't be — one request is only ever on one stage. It buys capacity and throughput under load, not latency. You need enough in flight to fill the pipeline."
