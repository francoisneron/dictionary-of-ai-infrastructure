---
description: High Bandwidth Memory. The stacked memory on data center GPUs, and the reason their bandwidth is measured in terabytes per second.
---

**High Bandwidth Memory.** The memory technology used for [VRAM](./VRAM.md) on data center [GPUs](./GPU.md). Rather than sitting in separate modules connected by a narrow bus, HBM is stacked vertically and placed on the same package as the processor, connected by an extremely wide interface.

The width is the whole point. Ordinary system memory moves data over a bus a few hundred bits wide; HBM stacks are thousands of bits wide, which is how a modern card reaches several terabytes per second of [memory bandwidth](./Memory%20bandwidth.md) rather than the tens of gigabytes per second a CPU sees. Since [decode](./Decode.md) is [memory bound](./Memory%20bound.md) — the whole model gets read once per [token](./Token.md) — that bandwidth translates almost directly into generation speed.

Capacity and generation are the two numbers that show up in practice, and they tend to move together. An A100 with HBM2e offers 80 GB at around 2 TB/s; an H100 with HBM3 offers 80 GB at 3.35 TB/s; an H200 with HBM3e offers 141 GB at 4.8 TB/s. Two cards can have identical [parameter count](./Parameter%20count.md) headroom and still differ substantially in tokens per second because of the generation of memory attached to them.

HBM is also why data center GPUs are expensive and why their capacity climbs slowly. It is manufactured in limited supply and packaged with the die, so you cannot add more after the fact — the number on the spec sheet is the number you get, which is what makes the [VRAM budget](./VRAM%20budget.md) a hard constraint rather than a soft one.

_Usage:_

"Both cards are 80 gigs, so they'll perform the same on this model."

"Check the HBM generation. One is 2 TB/s and the other 3.35 — decode speed roughly tracks that, so you'll see a real gap."
