---
description: The maximum tokens a model can process in one request. Longer contexts cost KV cache memory, which costs concurrency.
---

The maximum number of [tokens](./Token.md) a model can consider in a single request, prompt and generated output together. It is a property of the model, and it is the number people are quoting when they say a model is "128k".

Everything the model can use has to sit inside that window. Anything outside it does not exist as far as the request is concerned. The window is consumed by the system prompt, the conversation so far, any retrieved documents, and the output being generated, so a long exchange eventually runs out of room however aggressively you trim.

The infrastructure consequence is the one that catches people out. Every token in the window occupies [KV cache](./KV%20cache.md) memory for as long as the request is alive, and that memory comes out of the same [VRAM](./VRAM.md) the [model weights](./Model%20weights.md) already claimed. Doubling the context length of a typical request roughly doubles the cache each request holds, which roughly halves how many can run at once. Lower [concurrency](./Concurrency.md) means lower [throughput](./Throughput.md), and lower throughput on the same hardware means a higher [cost per million tokens](./Cost%20per%20million%20tokens.md). That chain is why a deployment comfortable at 4k contexts can fall over at 32k with nothing else changed.

Advertised maximum context and useful context are also different numbers. A model may accept 128k tokens while your [VRAM budget](./VRAM%20budget.md) only affords that length one request at a time.

_Usage:_

"The model supports 200k context, so let's set the limit to 200k."

"That sets your worst-case KV cache per request. Size it to what your traffic actually sends, or you'll be serving one user at a time whenever someone pastes a large document."
