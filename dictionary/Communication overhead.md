---
description: Time distributed GPUs spend exchanging data instead of computing. The tax that decides how far a model can usefully be split.
---

The time GPUs in a distributed deployment spend moving data between themselves rather than computing. It is the tax on [model parallelism](./Model%20parallelism.md), and it is what makes adding another GPU sometimes slower rather than faster.

The interconnect a transfer travels over changes the cost by orders of magnitude, which is why identical GPU counts perform so differently across machines:

| Path                           | Scope                     | Rough bandwidth                   | Carries                                                     |
| ------------------------------ | ------------------------- | --------------------------------- | ----------------------------------------------------------- |
| NVSwitch                       | Within a node             | Hundreds of GB/s, uniform         | Any-to-any [tensor parallelism](./Tensor%20parallelism.md)  |
| [NVLink](./NVLink.md)          | Between paired GPUs       | Hundreds of GB/s                  | Tensor parallelism                                          |
| PCIe                           | Within a node, shared bus | ~64 GB/s                          | Fallback, [CPU offload](./CPU%20offload.md)                 |
| InfiniBand + [RDMA](./RDMA.md) | Between nodes             | 100–400 Gb/s, microsecond latency | [Pipeline](./Pipeline%20parallelism.md) and cross-node work |
| Ethernet, no RDMA              | Between nodes             | Through the kernel, high latency  | Barely viable for parallelism                               |

Two properties decide how much a strategy suffers: how often it communicates and how much it sends. Tensor parallelism synchronizes twice per layer — over a hundred times per [token](./Token.md) — so it is acutely sensitive and belongs inside a fast domain. Pipeline parallelism transfers once per stage boundary and tolerates weak links. [Data parallelism](./Data%20parallelism.md) communicates nothing between replicas at all, which is why it scales furthest.

Hence the chain worth remembering: more tensor parallelism means more GPUs per request, which means more synchronization per token, which means more overhead. You are buying capacity and paying in coordination, and past some degree the payment exceeds the purchase. Where that point sits is a property of the fabric, not of the model, so it has to be measured on the actual hardware.

_Usage:_

"Why not just split it across all sixteen GPUs?"

"Because every layer would synchronize sixteen ways, twice, per token. Past the NVLink domain you're paying more in communication than you gain in bandwidth."
