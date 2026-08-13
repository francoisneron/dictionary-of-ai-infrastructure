---
description: NVIDIA's library for GPU-to-GPU collective communication. What tensor parallelism actually runs on, and a common failure point.
---

**NVIDIA Collective Communications Library.** The library that moves data between [GPUs](./GPU.md) in a distributed job. Every form of [model parallelism](./Model%20parallelism.md) issues its cross-GPU traffic through it, so NCCL's behaviour is the practical performance of a multi-GPU deployment.

It implements collective operations — patterns involving all participating processes rather than point-to-point sends. All-reduce, which combines a value across every GPU and gives every GPU the result, is the one [tensor parallelism](./Tensor%20parallelism.md) leans on: each layer's partial results are all-reduced so every card can proceed. All-gather and reduce-scatter appear in sharded setups, and all-to-all is what [expert parallelism](./Expert%20parallelism.md) uses to dispatch [tokens](./Token.md).

Two pieces of vocabulary come with it. Rank is the identifier of one process in the group — rank 0 through 7 for eight GPUs — and world size is how many there are in total. Both appear throughout engine configuration and in nearly every distributed error message.

NCCL discovers the available paths and picks the fastest: [NVLink](./NVLink.md) between GPUs that have it, PCIe otherwise, [RDMA](./RDMA.md) over InfiniBand or Ethernet between machines. This is also why it is a common source of trouble. A misconfigured container without the right network capabilities, a missing shared memory allocation, or an interface NCCL cannot see will either fail at startup or, worse, silently fall back to a slow path — a job that works but runs at a fraction of expected speed. Setting `NCCL_DEBUG=INFO` and reading which transport it selected is the standard first diagnostic.

_Usage:_

"Tensor parallel across two cards is barely faster than one, and they're both NVLinked."

"Check NCCL_DEBUG. If it picked PCIe instead of NVLink, the all-reduces are going the slow way and you'd never know from the logs otherwise."
