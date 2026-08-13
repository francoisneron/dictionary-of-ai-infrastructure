---
description: Letting one machine read another's memory without involving either CPU. What makes multi-node GPU work viable at all.
---

**Remote Direct Memory Access.** A networking capability that lets one machine write into another machine's memory directly, without the operating system or CPU on either side handling the data. With GPUDirect RDMA the network adapter reads and writes [GPU](./GPU.md) memory itself, so data never touches system RAM.

It matters because the ordinary network path is disastrous for this workload. Conventionally, sending a tensor between machines means copying it from GPU memory to system RAM, through the kernel's network stack, across the wire, and back up the same ladder on the far side. Each copy costs bandwidth and latency, and the CPU is involved throughout. RDMA removes all of it: the adapter moves bytes from one GPU to another with microsecond latency and no CPU involvement.

That is what makes multi-node work practical. [Tensor parallelism](./Tensor%20parallelism.md) spanning machines synchronizes constantly, and without RDMA the per-token cost of that synchronization exceeds any benefit — the standard advice to keep tensor parallelism inside one machine is really advice about interconnect quality. With InfiniBand or RoCE and RDMA available, spanning machines becomes a decision about [communication overhead](./Communication%20overhead.md) rather than an obvious mistake. [NCCL](./NCCL.md) uses it automatically when it is present.

The operational catch is that availability is not automatic. RDMA needs the hardware, the drivers, and container privileges to expose the devices. A container missing them falls back to TCP silently, and the job runs — slowly, with no error explaining why. On a managed platform this is worth confirming rather than assuming, since it is invisible until you run a [benchmark](./Benchmark.md).

_Usage:_

"Two-node tensor parallel is slower than one node alone."

"Is RDMA actually active in the container? Without it, NCCL is going over TCP through the kernel, and the per-layer all-reduce eats everything you gained."
