---
description: Time per output token. The pace of generation once it has started, and what a streamed response feels like to read.
---

**Time per output token.** The average time to produce each token after generation has begun, sometimes called inter-token latency. Where [TTFT](./TTFT.md) is how long the user waits to see anything, TPOT is how fast text arrives once it does.

It is set almost entirely by [decode](./Decode.md), which means it is set by [memory bandwidth](./Memory%20bandwidth.md). Producing a token requires reading the [model weights](./Model%20weights.md) involved out of [VRAM](./VRAM.md), so a larger model has a higher TPOT on the same card, and [quantization](./Quantization.md) lowers it by shrinking the bytes to move. Extra arithmetic capacity does not help, which surprises people who upgrade for compute and see no change.

The useful reference point is reading speed. A comfortable reading pace is roughly 5 to 10 tokens per second, so TPOT below about 100ms already outpaces the user and further gains stop being felt. This is what makes TPOT a threshold metric rather than one to optimize indefinitely: past the point where output arrives faster than it can be read, [throughput](./Throughput.md) is the better thing to spend capacity on.

Batching is where the trade shows up. Adding requests to a batch increases TPOT slightly for everyone while increasing total throughput a great deal, so the right [batch size](./Batch%20size.md) is the largest one that keeps TPOT under your threshold. At low concurrency, where the card is underused, [speculative decoding](./Speculative%20decoding.md) can cut TPOT outright by producing several tokens per pass. Averages also hide the thing users notice: a steady stream with occasional multi-second stalls reads worse than a uniformly slower one, and those stalls are usually another request's long [prefill](./Prefill.md) — the problem [chunked prefill](./Chunked%20prefill.md) exists to solve.

_Usage:_

"Should we push batch size higher? Throughput's still climbing."

"Watch TPOT as you go. Once tokens arrive slower than people read, you're trading visible smoothness for throughput nobody asked for."
