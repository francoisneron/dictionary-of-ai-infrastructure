---
description: NVIDIA's direct GPU-to-GPU interconnect. An order of magnitude faster than PCIe, and what makes tensor parallelism practical.
---

A direct high-bandwidth connection between [GPUs](./GPU.md) inside a machine, bypassing PCIe and the CPU entirely. Whether a pair of cards has it is often the difference between multi-GPU serving that works and multi-GPU serving that disappoints.

The gap against PCIe is large enough to change which strategies are viable. PCIe Gen5 x16 provides roughly 64 GB/s per direction and is shared with everything else on the bus; NVLink provides hundreds of GB/s directly between cards. Since [tensor parallelism](./Tensor%20parallelism.md) synchronizes twice per layer — over a hundred times per [token](./Token.md) on a large model — that difference compounds into most of the achievable [throughput](./Throughput.md). Eight-way tensor parallelism is routine over NVLink and usually a bad idea over PCIe.

At larger scale NVSwitch extends the idea. Rather than direct links between specific pairs, a switching fabric connects every GPU in the machine at full bandwidth, so an eight-GPU node behaves as one uniformly connected group instead of a graph with fast and slow edges. This is what DGX-class systems provide and why they are priced as they are.

The practical consequence is a deployment rule. Keep tensor parallelism within an NVLink domain and use [data parallelism](./Data%20parallelism.md) or [pipeline parallelism](./Pipeline%20parallelism.md) to cross beyond it, since those communicate far less. It is also worth verifying rather than assuming: `nvidia-smi topo -m` prints the actual topology, and cloud instances with the same GPU model can differ in how those GPUs are connected — a real source of [communication overhead](./Communication%20overhead.md) that never appears in the instance name.

_Usage:_

"Same eight A100s as the other provider, half the throughput."

"Run nvidia-smi topo -m on both. If one is NVSwitch and the other is PCIe pairs, that's your answer — the GPUs are identical and the fabric isn't."
