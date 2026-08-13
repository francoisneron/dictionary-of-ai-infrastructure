---
description: A GPU cloud platform offering dedicated instances, serverless inference, and multi-node clusters on the same infrastructure.
---

A cloud platform for renting [GPU](./GPU.md) compute. It offers the same hardware through several delivery models — dedicated instances you hold, serverless capacity that scales with demand, and managed multi-node environments — which makes it a convenient concrete example for the abstractions in this dictionary.

The two models you choose between cover the two shapes GPU work usually takes. A [Pod](./Pod.md) is a machine you rent and keep: it stays yours until you stop it, and you are billed for that whole period regardless of use. A [serverless endpoint](./Serverless%20endpoint.md) is an API backed by [workers](./Worker.md) that are created on demand and removed when traffic stops, billed by execution time. The first suits development, training, and steady production load; the second suits intermittent traffic, where [idle cost](./Idle%20cost.md) would otherwise dominate the bill. The trade between them is the [scale to zero](./Scale%20to%20zero.md) question — idle cost against [cold start](./Cold%20start.md) — with [FlashBoot](./FlashBoot.md) narrowing the gap.

Around those sit the supporting pieces. A [Network Volume](./Network%20volume.md) holds [model weights](./Model%20weights.md) independently of any instance's lifecycle. A [Template](./Template.md) captures a reusable environment definition. Instant Clusters provision several networked GPU machines together for distributed work that needs [RDMA](./RDMA.md) between nodes. Flash is a Python framework for defining and running remote GPU workloads from local code, and `runpodctl` is the command line tool for driving all of it.

_Usage:_

"Should this run on a Pod or on Serverless?"

"How constant is the traffic? Steady load keeps a Pod busy and it's cheaper. A few hundred requests a day scattered around, and you're paying for idle GPU most of the time."
