---
description: The prompt length, output length and concurrency of your actual traffic. What makes a performance number mean anything.
---

The characteristic profile of a deployment's traffic: how long the prompts are, how long the outputs are, how many requests arrive at once, and how much the prompts share. It is the missing context that makes most performance numbers uninterpretable.

The reason it matters so much is that the two stages of inference have opposite bottlenecks. Input [tokens](./Token.md) are processed in [prefill](./Prefill.md), which is [compute bound](./Compute%20bound.md); output tokens are produced in [decode](./Decode.md), which is [memory bound](./Memory%20bound.md). The ratio between them decides which limit you are against, and therefore which GPU is right, which engine settings matter, and where [saturation](./Saturation.md) sits:

| Shape               | Example                            | Dominated by                                 | Favours                                                    |
| ------------------- | ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| Long in, short out  | Summarization, classification, RAG | Prefill                                      | Arithmetic; [prefix caching](./Prefix%20caching.md)        |
| Short in, long out  | Story or code generation           | Decode                                       | [Memory bandwidth](./Memory%20bandwidth.md); large batches |
| Long in, long out   | Agents, document rewriting         | Both, plus heavy [KV cache](./KV%20cache.md) | Memory capacity                                            |
| Short in, short out | Extraction, routing                | Overhead and scheduling                      | High [concurrency](./Concurrency.md)                       |

Shape also sets the memory arithmetic. Sequence length times concurrency is what [KV cache capacity](./KV%20cache%20capacity.md) has to accommodate, so a shift toward longer contexts lowers the concurrency ceiling with no change in traffic volume.

Measure it rather than estimating it. Token count distributions from production logs — including the tail, since the longest requests drive worst-case memory — are what a [benchmark](./Benchmark.md) should replay. A guessed shape produces a confidently wrong capacity plan.

_Usage:_

"Which GPU should we standardize on?"

"Depends on the shape. Mostly 10k-token RAG prompts with short answers is prefill-heavy, so pay for compute. Short prompts and long generations is the opposite."
