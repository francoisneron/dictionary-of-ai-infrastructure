---
description: Guessing several tokens with a cheap model and checking them all in one pass. Trades spare compute for lower latency.
---

Generating several candidate [tokens](./Token.md) quickly with a cheap method, then verifying them all in a single [forward pass](./Forward%20pass.md) of the real model. Accepted guesses are kept, so one pass can yield several tokens instead of one.

It works because of the asymmetry [decode](./Decode.md) creates. Decode is [memory bound](./Memory%20bound.md): a pass spends its time reading [model weights](./Model%20weights.md) out of [VRAM](./VRAM.md) and leaves most of the arithmetic units idle. Checking five proposed tokens in that pass costs almost nothing extra, because the expensive part — moving the weights — happens either way. The spare compute is already paid for.

A draft model produces the guesses: a much smaller model, or a compressed head attached to the main one, fast enough that generating several candidates is cheap. The target model then verifies them in one pass, accepting the longest prefix that matches what it would have produced itself. Crucially the output is identical to unassisted generation — verification rejects anything the target would not have chosen, so this is a latency optimization, not a quality trade.

The gain depends entirely on the acceptance rate, which depends on how well the draft predicts the target. Predictable text — code, structured output, formulaic prose — accepts well and can cut [TPOT](./TPOT.md) substantially. Unpredictable text accepts poorly, and then the draft work is pure overhead.

The important caveat is that it spends exactly the resource batching wants. Under high [concurrency](./Concurrency.md) the arithmetic units are no longer idle, so there is no spare capacity to trade and speculation can reduce total [throughput](./Throughput.md). It helps most at low concurrency, where latency matters and the [GPU](./GPU.md) is underused.

_Usage:_

"Speculative decoding made our batch job slower."

"It trades spare compute for latency, and at high batch sizes there isn't any spare. It's a low-concurrency optimization — turn it off for bulk work."
