<!--
  GENERATED FILE — DO NOT EDIT.
  Source: dictionary/*.md, internal/Curriculum.md, internal/README.template.md
  Regenerate: npm run generate
-->

# AI Infrastructure Dictionary

**Running a model in production feels like it needs a specialist**. Unexplained jargon. Out-of-memory errors that arrive without warning. GPU bills that don't seem to match the work being done.

It doesn't, really. Most of the confusion comes from the vocabulary rather than the ideas: the terms are borrowed from four different fields — machine learning, systems programming, distributed computing, and cloud operations — and nobody hands you a glossary.

The basic terms of engagement are learnable in an afternoon. Once you have them, capacity planning stops being guesswork.

Why does a model that fits in VRAM still fall over under load? Why does the first token take so much longer than the rest? Why does doubling the context window halve how many users you can serve? Why is the cheaper GPU sometimes the more expensive one?

Each has a clean answer, once someone tells you the words to use.

That's what this dictionary is for. **The vocabulary of AI infrastructure, translated into plain English**.

The goal is not to catalog every term in machine learning or cloud computing. These are the concepts someone should understand to speak credibly about serving models on GPUs — and, more to the point, the relationships between them. Memorizing that TTFT means time to first token is easy. Explaining why TTFT climbs under concurrency, how prefill contributes to it, and what that does to your cost per million tokens is the part that matters.

---

## Table of contents

<details>
<summary>Section 1 — The Model and Its Tokens</summary>

- [Model weights](#model-weights)
- [Parameter count](#parameter-count)
- [Mixture of experts](#mixture-of-experts)
- [Active parameters](#active-parameters)
- [Token](#token)
- [Tokenizer](#tokenizer)
- [Context window](#context-window)

</details>

<details>
<summary>Section 2 — The Machine It Runs On</summary>

- [GPU](#gpu)
- [VRAM](#vram)
- [HBM](#hbm)
- [Memory bandwidth](#memory-bandwidth)
- [Memory bound](#memory-bound)
- [Compute bound](#compute-bound)
- [CUDA](#cuda)
- [GPU utilization](#gpu-utilization)

</details>

<details>
<summary>Section 3 — Making It Fit</summary>

- [Precision](#precision)
- [FP8](#fp8)
- [Quantization](#quantization)
- [VRAM budget](#vram-budget)
- [CPU offload](#cpu-offload)
- [OOM](#oom)

</details>

<details>
<summary>Section 4 — How a Request Is Served</summary>

- [Inference engine](#inference-engine)
- [vLLM](#vllm)
- [Forward pass](#forward-pass)
- [Prefill](#prefill)
- [Decode](#decode)
- [Streaming](#streaming)
- [OpenAI-compatible API](#openai-compatible-api)

</details>

<details>
<summary>Section 5 — What You Measure</summary>

- [Latency](#latency)
- [TTFT](#ttft)
- [TPOT](#tpot)
- [Throughput](#throughput)
- [Tail latency](#tail-latency)
- [Goodput](#goodput)

</details>

<details>
<summary>Section 6 — The KV Cache & Batching</summary>

- [KV cache](#kv-cache)
- [KV cache capacity](#kv-cache-capacity)
- [PagedAttention](#pagedattention)
- [KV cache eviction](#kv-cache-eviction)
- [Prefix caching](#prefix-caching)
- [KV cache quantization](#kv-cache-quantization)
- [Batch size](#batch-size)
- [Continuous batching](#continuous-batching)
- [Chunked prefill](#chunked-prefill)
- [Speculative decoding](#speculative-decoding)

</details>

<details>
<summary>Section 7 — Splitting Across GPUs</summary>

- [Model parallelism](#model-parallelism)
- [Tensor parallelism](#tensor-parallelism)
- [Pipeline parallelism](#pipeline-parallelism)
- [Data parallelism](#data-parallelism)
- [Expert parallelism](#expert-parallelism)
- [NCCL](#nccl)
- [NVLink](#nvlink)
- [RDMA](#rdma)
- [Communication overhead](#communication-overhead)

</details>

<details>
<summary>Section 8 — Serving Real Traffic</summary>

- [Endpoint](#endpoint)
- [Worker](#worker)
- [Queue depth](#queue-depth)
- [Concurrency](#concurrency)
- [Load balancing](#load-balancing)
- [Backpressure](#backpressure)
- [Health check](#health-check)
- [Timeout](#timeout)
- [Saturation](#saturation)
- [Autoscaling](#autoscaling)

</details>

<details>
<summary>Section 9 — Getting the Model Onto the Machine</summary>

- [Container image](#container-image)
- [Model cache](#model-cache)
- [Network volume](#network-volume)
- [Model load time](#model-load-time)
- [Cold start](#cold-start)
- [Scale to zero](#scale-to-zero)

</details>

<details>
<summary>Section 10 — Benchmarking & What It Costs</summary>

- [Benchmark](#benchmark)
- [Workload shape](#workload-shape)
- [Concurrency sweep](#concurrency-sweep)
- [GPU hour](#gpu-hour)
- [Idle cost](#idle-cost)
- [Cost per million tokens](#cost-per-million-tokens)
- [Price performance](#price-performance)

</details>

<details>
<summary>Section 11 — Runpod</summary>

- [Runpod](#runpod)
- [Pod](#pod)
- [Serverless endpoint](#serverless-endpoint)
- [Queue-based endpoint](#queue-based-endpoint)
- [Load-balancing endpoint](#load-balancing-endpoint)
- [Active worker](#active-worker)
- [FlashBoot](#flashboot)
- [Template](#template)

</details>

## Section 1 — The Model and Its Tokens

### Model weights

The learned numerical values that make up a trained model. They occupy most of the [VRAM](#vram) a deployment needs, and they are what you are actually downloading when you pull a model from a hub.

A published model is a directory rather than a single file. It holds the weights split across several shards, a config file describing the architecture, and the [tokenizer](#tokenizer) files needed to turn text into [tokens](#token). Hugging Face is where most of this is distributed. The shards are usually safetensors, a format designed to be memory-mapped and loaded without executing arbitrary code — the older alternative, pickled PyTorch checkpoints, can run code on load. GGUF is a different packaging used mainly by llama.cpp-style runtimes, bundling quantized weights and metadata into a single file.

Size on disk follows directly from [parameter count](#parameter-count) and [precision](#precision): bytes per parameter times the number of parameters. A 70B model at BF16 is around 140 GB; the same model at INT4 is around 35 GB. That number sets the floor of the [VRAM budget](#vram-budget), and it is also what you pay for in download time every time a [worker](#worker) starts without a [model cache](#model-cache) to read from.

Weights are read-only during inference. Every request runs against the same bytes, which is why one loaded copy can serve many requests at once, and why [data parallelism](#data-parallelism) means paying the whole memory cost again for each replica.

_Usage:_

"Why is the container image ninety gigabytes?"

"It's baking the model weights into the image. Pull them onto a network volume instead and the image drops to a couple of gigs — and your cold starts stop being dominated by the registry."

### Parameter count

The number of learned values in a model — the figure in names like Llama 3 70B or Mixtral 8x7B. It is the first input to every memory calculation you will do.

Parameter count times bytes per parameter gives the size of the [model weights](#model-weights), and therefore the floor of the [VRAM budget](#vram-budget). At BF16 that is two bytes each, so a 70B model needs roughly 140 GB before anything else is accounted for. That is more than a single 80 GB card holds, which is why serving that model requires either [quantization](#quantization) or splitting it across GPUs with [tensor parallelism](#tensor-parallelism).

The number is a rough proxy for output quality and a precise proxy for cost. More parameters means more memory read on every [forward pass](#forward-pass), which is why larger models generate more slowly on the same hardware even when they fit comfortably. Since [decode](#decode) is [memory bound](#memory-bound), the weights have to be streamed out of [VRAM](#vram) once per [token](#token), and roughly speaking, doubling the parameter count halves the tokens per second.

Total parameter count stops predicting speed for [mixture of experts](#mixture-of-experts) models, where only part of the network runs on any given token. There the number that predicts compute is [active parameters](#active-parameters), while total count still predicts memory. Such a model can occupy the VRAM of a very large model while doing the arithmetic of a much smaller one.

_Avoid:_ comparing an MoE model to a dense one by total parameter count alone — the two numbers are not measuring the same thing.

_Usage:_

"It's a 70B, so an 80 gig card should do it."

"70B at BF16 is 140 gigs of weights on its own. Either quantize it or run tensor parallel across two cards — and you still need room left for the KV cache."

### Mixture of experts

An architecture that splits parts of the model into many parallel subnetworks — experts — and routes each [token](#token) to only a few of them. A small router network picks which experts handle which token, so most of the model sits idle on any given step.

The point is to break the usual link between model size and cost per token. A dense model runs every parameter for every token, so doubling [parameter count](#parameter-count) doubles the work. An MoE model can hold far more parameters while running a fixed, small fraction of them, which buys the quality that comes with scale without the matching compute bill. Mixtral 8x7B and DeepSeek's larger models are the familiar examples.

The infrastructure consequence is that the two numbers you care about come apart, and this is where MoE surprises people. All the experts have to be resident in [VRAM](#vram), because any token might route to any of them, so memory is set by the total parameter count. Only the [active parameters](#active-parameters) are read per token, so speed is set by a much smaller number. You end up provisioning memory for a very large model and getting the [decode](#decode) speed of a much smaller one — good value, but only if you sized the [VRAM budget](#vram-budget) on the total.

Serving one across multiple GPUs also needs a different strategy. Splitting every layer with [tensor parallelism](#tensor-parallelism) works, but distributing whole experts across devices with [expert parallelism](#expert-parallelism) usually maps better onto how the model actually computes.

_Usage:_

"It's 8x7B, so about 56 billion — call it a 56B model."

"For memory, yes. For speed it behaves like a 13B, because only two experts run per token. Don't size the GPU off the throughput you're expecting."

### Active parameters

The subset of a model's parameters that actually participate in producing a given [token](#token). In a dense model this is all of them; in a [mixture of experts](#mixture-of-experts) model it is a small fraction, because the router sends each token to only a few experts.

The number matters because it, not the total [parameter count](#parameter-count), is what predicts generation speed. [Decode](#decode) is [memory bound](#memory-bound): the time to produce a token is dominated by reading the weights involved out of [VRAM](#vram). If only 13 billion of a model's 47 billion parameters are read per token, the [memory bandwidth](#memory-bandwidth) cost is that of a 13B model, and the tokens per second follow.

Holding both numbers at once is the habit worth building. Total parameters tell you what will fit — every expert has to be resident, since any token might route to any of them. Active parameters tell you how fast it will run once it fits. A model can be expensive to host and cheap to run, and quoting either number alone gives a misleading picture of the deployment.

The gap between the two is also why MoE models are attractive on hardware with plenty of memory and unremarkable bandwidth, and unattractive on the reverse. It is worth checking against the specific card rather than assuming, because the ratio varies a lot between architectures.

_Usage:_

"The 47B model is generating faster than the 34B dense one. Is the benchmark wrong?"

"It's an MoE — about 13B active per token. It reads a third of the weights, so it decodes faster. It still needs the memory for all 47."

### Token

The unit a model reads and writes. Roughly word-sized but not exactly — common words are one token, rare or long ones split into several. [Context window](#context-window) size, memory use, [throughput](#throughput), and cost are all counted in tokens.

Text becomes tokens via a [tokenizer](#tokenizer): a fixed vocabulary of tens of thousands of fragments that splits any input into a sequence of vocabulary entries. The model never sees characters or words. Every request is converted to tokens on the way in, processed during [prefill](#prefill), and produced one at a time during [decode](#decode) on the way out.

As a rule of thumb, a token is about three-quarters of an English word, so a thousand tokens is roughly 750 words. Code and structured data are less predictable. Common keywords tokenize compactly, while generated identifiers, hashes, and base64 blobs split into many tokens per "word". Text that appeared often in the tokenizer's source material gets short encodings; text that didn't gets chopped into pieces. This is why a small-looking payload full of UUIDs can occupy far more of the window than its size suggests.

Tokens are the unit the whole system is measured in, which is why they appear in nearly every other entry here. Each token in a sequence adds state to the [KV cache](#kv-cache), so token count is what turns into GPU memory. Generation speed is quoted in tokens per second. Billing is normalized to [cost per million tokens](#cost-per-million-tokens). When sizing a deployment, the token count of a typical request — not the number of requests — is what decides how much hardware you need.

_Avoid:_ "word" — token boundaries don't match word boundaries, and every metric that matters is counted per token.

_Usage:_

"The prompt is only about 400 words, so we're fine on context."

"Run it through the tokenizer first. It's mostly JSON with UUIDs in it, and those split badly — could easily be double what you'd guess from the word count."

### Tokenizer

The software that converts text into the numeric IDs a model consumes, and converts generated IDs back into text. It ships with the [model weights](#model-weights) and is specific to them — the wrong tokenizer produces fluent nonsense rather than an error.

A tokenizer holds a fixed vocabulary, typically 32,000 to 256,000 entries, learned before training by finding the fragments that most efficiently encode a large body of text. Encoding is a lookup: the text is split into the longest vocabulary entries that match, and each becomes a [token](#token) ID. Two markers usually bracket the sequence — a beginning-of-sequence token, and an end-of-sequence token the model emits to say it is finished, which is what actually stops [decode](#decode).

Chat models add a layer on top. A chat template turns a list of role-tagged messages into the exact string the model was trained on, with its own delimiters around each turn. Getting this wrong is a common and quiet failure: the model still responds, just worse, because the input no longer looks like anything it saw in training. Serving through an [OpenAI-compatible API](#openai-compatible-api) usually means the [inference engine](#inference-engine) applies the template for you from the model's own config.

Vocabulary size has a direct infrastructure cost. A tokenizer that encodes your text inefficiently produces more tokens for the same content, which means more [prefill](#prefill) work, more [KV cache](#kv-cache), and a larger bill for identical input. This is worth checking when serving non-English text, where vocabularies trained mostly on English can be two or three times less efficient.

_Usage:_

"Same prompt, same length, but the Japanese requests cost twice as much."

"Check the token counts, not the character counts. That tokenizer is English-heavy, so it splits Japanese into far more tokens."

### Context window

The maximum number of [tokens](#token) a model can consider in a single request, prompt and generated output together. It is a property of the model, and it is the number people are quoting when they say a model is "128k".

Everything the model can use has to sit inside that window. Anything outside it does not exist as far as the request is concerned. The window is consumed by the system prompt, the conversation so far, any retrieved documents, and the output being generated, so a long exchange eventually runs out of room however aggressively you trim.

The infrastructure consequence is the one that catches people out. Every token in the window occupies [KV cache](#kv-cache) memory for as long as the request is alive, and that memory comes out of the same [VRAM](#vram) the [model weights](#model-weights) already claimed. Doubling the context length of a typical request roughly doubles the cache each request holds, which roughly halves how many can run at once. Lower [concurrency](#concurrency) means lower [throughput](#throughput), and lower throughput on the same hardware means a higher [cost per million tokens](#cost-per-million-tokens). That chain is why a deployment comfortable at 4k contexts can fall over at 32k with nothing else changed.

Advertised maximum context and useful context are also different numbers. A model may accept 128k tokens while your [VRAM budget](#vram-budget) only affords that length one request at a time.

_Usage:_

"The model supports 200k context, so let's set the limit to 200k."

"That sets your worst-case KV cache per request. Size it to what your traffic actually sends, or you'll be serving one user at a time whenever someone pastes a large document."

## Section 2 — The Machine It Runs On

### GPU

**Graphics Processing Unit.** The accelerator nearly all model inference runs on. A GPU is thousands of simple cores operating in parallel, attached to its own memory, and it suits inference because a [forward pass](#forward-pass) is mostly large matrix multiplications.

Data center GPUs add dedicated matrix hardware — NVIDIA calls these Tensor Cores — which handle the multiply-accumulate work that dominates neural network computation, and run it faster at reduced [precision](#precision). Getting at any of this from software goes through [CUDA](#cuda), which is a large part of why NVIDIA hardware is the default.

When choosing a GPU for serving, the specification that matters first is usually not arithmetic speed. It is memory. How much [VRAM](#vram) the card has decides whether the [model weights](#model-weights) fit at all and how much room is left for [KV cache](#kv-cache); how much [memory bandwidth](#memory-bandwidth) it has decides how fast [decode](#decode) runs. Two cards with similar advertised compute can perform very differently on the same workload for this reason.

Comparing GPUs by hourly price is the common mistake. A card costing twice as much per hour that produces four times the [throughput](#throughput) is half the price on the metric that actually bills, which is [cost per million tokens](#cost-per-million-tokens). The right comparison is [price performance](#price-performance) measured on your own [workload shape](#workload-shape), not inferred from a spec sheet.

_Usage:_

"Let's just take the cheapest card the model fits on."

"Fitting isn't the bar. Check what's left after the weights load — that's your KV cache budget, and a card with no headroom serves one request at a time."

### VRAM

The memory physically attached to a [GPU](#gpu). Everything a deployment needs has to fit in it: the [model weights](#model-weights), the [KV cache](#kv-cache), the activations produced during computation, and the inference runtime's own overhead.

VRAM is the binding constraint on most inference deployments, and it is fixed — you cannot add more to a card. On data center GPUs it is [HBM](#hbm), stacked beside the die for bandwidth rather than socketed as separate modules. Capacity currently runs from 24 GB on consumer cards to 141 GB on an H200, which is why that one number drives so many deployment decisions.

The mistake worth naming is treating "the model fits in VRAM" as the end of the sizing question. Weights are a fixed cost paid once at load. The KV cache grows with every [token](#token) of every in-flight request, so the memory left over after loading is what actually decides how many users you can serve at once. A 70B model quantized onto an 80 GB card might leave 20 GB free, and that 20 GB — not the 80 — is your real capacity. Accounting for this properly is what the [VRAM budget](#vram-budget) is for.

When it runs out you get [OOM](#oom), and usually not at startup. The failure arrives later, under [concurrency](#concurrency), when a burst of long requests expands the cache past whatever headroom was left.

_Usage:_

"It loaded fine on the 48 gig card, so we're good."

"Loading is the easy part. Check what's free afterwards — that's your KV cache budget, and it's the thing that sets your concurrency ceiling."

### HBM

**High Bandwidth Memory.** The memory technology used for [VRAM](#vram) on data center [GPUs](#gpu). Rather than sitting in separate modules connected by a narrow bus, HBM is stacked vertically and placed on the same package as the processor, connected by an extremely wide interface.

The width is the whole point. Ordinary system memory moves data over a bus a few hundred bits wide; HBM stacks are thousands of bits wide, which is how a modern card reaches several terabytes per second of [memory bandwidth](#memory-bandwidth) rather than the tens of gigabytes per second a CPU sees. Since [decode](#decode) is [memory bound](#memory-bound) — the whole model gets read once per [token](#token) — that bandwidth translates almost directly into generation speed.

Capacity and generation are the two numbers that show up in practice, and they tend to move together. An A100 with HBM2e offers 80 GB at around 2 TB/s; an H100 with HBM3 offers 80 GB at 3.35 TB/s; an H200 with HBM3e offers 141 GB at 4.8 TB/s. Two cards can have identical [parameter count](#parameter-count) headroom and still differ substantially in tokens per second because of the generation of memory attached to them.

HBM is also why data center GPUs are expensive and why their capacity climbs slowly. It is manufactured in limited supply and packaged with the die, so you cannot add more after the fact — the number on the spec sheet is the number you get, which is what makes the [VRAM budget](#vram-budget) a hard constraint rather than a soft one.

_Usage:_

"Both cards are 80 gigs, so they'll perform the same on this model."

"Check the HBM generation. One is 2 TB/s and the other 3.35 — decode speed roughly tracks that, so you'll see a real gap."

### Memory bandwidth

The rate at which a [GPU](#gpu) moves data between its compute units and its own [VRAM](#vram), measured in terabytes per second. It is the ceiling on how fast a model generates text, and the reason [decode](#decode) behaves so differently from [prefill](#prefill).

The mechanism is simple once stated. Producing one [token](#token) requires reading every weight the model uses for that token, doing a small amount of arithmetic with each, and moving on. A 70B model at BF16 means reading 140 GB per token. On a card with 3.35 TB/s of bandwidth, that puts a floor of roughly 40 ms per token for a single request no matter how fast the arithmetic units are. The GPU spends most of that time waiting on memory, which is what [memory bound](#memory-bound) means.

This is why [HBM](#hbm) exists, why bandwidth is quoted alongside capacity on every data center card, and why the two main levers on generation speed both reduce bytes moved rather than arithmetic done. [Quantization](#quantization) shrinks the [model weights](#model-weights), so fewer bytes cross the bus per token. Batching amortizes the read: the weights are fetched once and used for every request in the batch, so [throughput](#throughput) rises steeply while per-request speed barely changes.

Prefill is the opposite case. It processes all input tokens together, which gives the arithmetic units enough work that they become the limit instead — [compute bound](#compute-bound) rather than memory bound. The same GPU is constrained by different hardware depending on which stage it is in.

_Usage:_

"We moved to a card with far more compute and generation didn't get any faster."

"Decode is memory bound — it re-reads the weights every token. You needed more bandwidth, or a smaller model, not more FLOPs."

### Memory bound

A workload whose speed is limited by how fast data moves between memory and the compute units, rather than by how fast the arithmetic runs. The processor spends much of its time waiting, so adding arithmetic capacity changes nothing.

[Decode](#decode) is the canonical memory bound workload in inference, and the reason is structural. Producing one [token](#token) requires reading every weight the model uses for it and doing only a few operations with each value before moving on. There is very little arithmetic per byte fetched, so [memory bandwidth](#memory-bandwidth) sets the ceiling. A 70B model at BF16 means moving 140 GB per token, and no amount of extra compute makes that faster.

Once you recognise a workload as memory bound, the levers follow directly. Move fewer bytes: [quantization](#quantization) shrinks the [model weights](#model-weights), so a lower [precision](#precision) speeds up generation as a side effect of using less memory. Or get more work out of each byte: batching reads the weights once and applies them to every request in the batch, which is why [throughput](#throughput) rises so steeply with [concurrency](#concurrency) while per-request speed barely moves. Buying a card with more arithmetic and the same bandwidth does nothing.

The diagnostic sign is a [GPU](#gpu) reporting high utilization while delivering low throughput. Utilization counts time spent with work resident, including time stalled on memory, so a memory bound kernel can read as busy while achieving a small fraction of the card's arithmetic capability.

_Usage:_

"We upgraded to a card with double the FLOPs and generation is the same speed."

"Decode is memory bound. The bandwidth barely changed, so neither did tokens per second — you needed more batching, not more compute."

### Compute bound

A workload whose speed is limited by how much arithmetic the hardware can perform, rather than by how fast it can read memory. The compute units stay busy, and going faster means more arithmetic capacity or less work.

[Prefill](#prefill) is the compute bound stage of inference. It processes every input [token](#token) at once, so each weight that gets read is used for thousands of tokens rather than one. That ratio of arithmetic to bytes fetched is high enough that the matrix units become the limit, which is the opposite of [decode](#decode) and the reason the two stages respond to different hardware. It is also why prefill time grows with prompt length in a way generation time does not: doubling the prompt genuinely doubles the arithmetic.

Because prefill is compute bound, it benefits from the things that raise arithmetic throughput — Tensor Cores, lower [precision](#precision) formats with hardware support like [FP8](#fp8), and the kernel work that [CUDA](#cuda) libraries provide. Batching helps it far less than it helps decode, since the units are already saturated by a single long prompt.

The practical consequence is that a workload's [shape](#workload-shape) decides which limit you are against. Long prompts with short answers are prefill-heavy and compute bound, so a card with strong arithmetic wins. Short prompts with long answers are decode-heavy and [memory bound](#memory-bound), so [memory bandwidth](#memory-bandwidth) wins. A [benchmark](#benchmark) with the wrong ratio measures the wrong bottleneck and picks the wrong GPU.

_Usage:_

"Our RAG requests take ages to start but stream fine once they do."

"You're prefill-heavy — 20k of retrieved context is compute bound work before the first token. Chunked prefill will stop it blocking everyone else."

### CUDA

NVIDIA's platform for general-purpose computation on [GPUs](#gpu) — a language extension, a compiler, a runtime, and a large stack of optimized libraries. Every mainstream [inference engine](#inference-engine) ultimately issues CUDA work.

The unit of execution is a kernel: a function compiled to run across thousands of GPU threads at once. Inference performance is largely a question of which kernels run and how well they are written, which is why engine choice matters as much as hardware choice. Several standard optimizations live at this level. Kernel fusion combines a sequence of operations into one launch, avoiding round trips through memory between each step. CUDA Graphs record a repeated sequence of launches and replay it as a unit, removing per-launch CPU overhead that becomes significant when [decode](#decode) steps are only milliseconds long. FlashAttention is a hand-written attention kernel that restructures the computation to keep intermediate values in fast on-chip memory rather than writing them out to [VRAM](#vram), which makes long [context windows](#context-window) practical.

Writing kernels directly is specialist work, so Triton exists as a middle layer — a Python-like language that compiles to GPU code and gets much of the performance for far less effort. A growing share of engine code is written in it.

CUDA is also the reason the ecosystem is hard to leave. It is NVIDIA-only, and the accumulated libraries, kernels, and tooling built on it represent years of work that competing platforms have to replicate before their hardware is a practical option regardless of its specifications.

_Usage:_

"Can we run this on the AMD cards? They're cheaper per gigabyte."

"Depends whether your engine has a working non-CUDA backend for this model. The card isn't the problem, the kernel coverage is."

### GPU utilization

The percentage of time a [GPU](#gpu) has work resident on it, as reported by tools like `nvidia-smi`. It is the first number people check and the most frequently misread.

The metric counts time during which at least one kernel is executing. It does not measure how much of the card's arithmetic capacity that kernel is using. A [memory bound](#memory-bound) kernel stalled on [VRAM](#vram) reads still counts as busy, so single-request [decode](#decode) can report high utilization while achieving a small fraction of the hardware's throughput. This is why a deployment can look saturated and still get several times more [throughput](#throughput) from more [concurrency](#concurrency).

The reverse misreading also happens. Low utilization during long [prefill](#prefill) phases, or on a workload dominated by queueing rather than computation, points at the scheduler or the client rather than the GPU. In both directions the number tells you whether the card is occupied, not whether it is earning its keep.

Memory utilization is a separate and more actionable figure: what fraction of VRAM is allocated. Since engines usually claim a fixed fraction up front for the [KV cache](#kv-cache) pool, this often reads as constant and high whether or not the cache is being used, so it needs interpreting against the engine's own reported cache usage rather than taken at face value.

_Avoid:_ reporting utilization as evidence of efficiency. Tokens per second per dollar is the number that decides anything; utilization is a diagnostic for explaining it.

_Usage:_

"GPU's at 95%, we're maxed out — time to add another one."

"That just means kernels are running. Check tokens per second against a concurrency sweep first; decode at low batch reads as busy while wasting most of the card."

## Section 3 — Making It Fit

### Precision

The number format used to store [model weights](#model-weights) and perform arithmetic. It decides bytes per parameter, and therefore both how much memory a model occupies and how fast that memory can be read.

Training generally happens at higher precision than inference needs, so serving a model in a narrower format is routine rather than a compromise. Formats differ in two ways: how many bits, and how those bits divide between range and detail. BF16 keeps the exponent range of FP32 with fewer mantissa bits, which is why it tolerates the wide value swings inside neural networks better than FP16 does at identical size.

| Format          | Bytes/param | 70B weights | Notes                                                           |
| --------------- | ----------- | ----------- | --------------------------------------------------------------- |
| FP32            | 4           | ~280 GB     | Full precision. Rarely used for inference.                      |
| FP16            | 2           | ~140 GB     | Long-standing default. Narrow exponent range.                   |
| BF16            | 2           | ~140 GB     | Same size, wider range. The common default now.                 |
| [FP8](#fp8) | 1           | ~70 GB      | Needs Hopper-class hardware or newer.                           |
| INT8            | 1           | ~70 GB      | Integer, usually reached via [quantization](#quantization). |
| INT4            | 0.5         | ~35 GB      | Largest saving, most quality risk.                              |

Mixed precision is the normal arrangement in practice — weights stored in one format, accumulation done in a wider one, and sensitive layers kept full width. The [inference engine](#inference-engine) handles that; the format you choose is the one for the weights.

Lower precision buys three things at once: a smaller [VRAM budget](#vram-budget), more room left for [KV cache](#kv-cache), and faster [decode](#decode), since [memory bandwidth](#memory-bandwidth) is the bottleneck and there are fewer bytes to move. The cost is accuracy, which degrades gradually rather than failing outright.

_Usage:_

"Can we run everything at INT4 and use smaller cards?"

"Sometimes. Measure output quality on your own prompts first — the loss doesn't show up in a smoke test, it shows up on the hard inputs."

### FP8

**8-bit floating point.** A numeric [precision](#precision) that stores each value in one byte while keeping a floating point's exponent, so it handles the wide range of magnitudes inside a neural network better than an 8-bit integer does.

What makes FP8 different from other [quantization](#quantization) routes is hardware support. H100-class GPUs and newer implement it natively in their matrix units, so the arithmetic runs at FP8 rather than being unpacked back to a wider format first. That means the saving is not only in memory but in compute throughput too, which helps [prefill](#prefill) as well as [decode](#decode). On older cards the format either isn't supported or is emulated, and the benefit largely disappears — this is the first thing to check before choosing it.

In practice FP8 has become the default middle setting. It halves the [model weights](#model-weights) against BF16, roughly doubling the room left for [KV cache](#kv-cache), while losing noticeably less quality than INT4 does. For most production serving the trade lands well: you get most of the memory saving with a quality difference that is hard to detect on real traffic.

Two variants exist, differing in how the byte splits between exponent and mantissa. E4M3 carries more precision and less range and is the usual choice for weights and activations; E5M2 carries more range and shows up in training. The [inference engine](#inference-engine) generally picks for you.

_Usage:_

"We quantized to FP8 and saw no speedup, just the memory saving."

"What card? Below Hopper there's no native FP8, so it's converting back to 16-bit to do the maths. You get the smaller footprint and none of the compute win."

### Quantization

Converting [model weights](#model-weights) from the [precision](#precision) they were trained at to a narrower one, so the model occupies less memory. A 70B model at BF16 needs around 140 GB; quantized to INT4 it needs around 35 GB, which is the difference between four GPUs and one.

The gains compound in a way worth spelling out, because it is the most useful causal chain in this dictionary. Smaller weights mean a smaller [VRAM budget](#vram-budget). A smaller budget leaves more free memory after loading, which is [KV cache capacity](#kv-cache-capacity). More capacity means higher [concurrency](#concurrency), which means higher [throughput](#throughput) on the same card, which means a lower [cost per million tokens](#cost-per-million-tokens). And separately from all of that, [decode](#decode) gets faster on its own, because it is [memory bound](#memory-bound) and there are simply fewer bytes to read per [token](#token).

Methods differ in how much they preserve. The naive approach rounds every weight the same way and loses noticeably more quality than it needs to. Better methods use a small calibration dataset to find which weights matter most and keep those at higher precision — AWQ and GPTQ are the two most commonly encountered. [FP8](#fp8) is a different route again, using hardware support rather than a conversion pass.

The cost is accuracy, and its shape is what makes it dangerous. Quality degrades gradually rather than breaking, and it degrades most on the hardest inputs, so a smoke test passes while real traffic gets subtly worse. Evaluate on your own prompts before shipping.

_Avoid:_ treating "it still answers correctly" as evidence that quantization was free. Compare against the unquantized model on inputs you actually care about.

_Usage:_

"AWQ got us onto one card instead of two. Ship it?"

"Run your eval set against both first. The failure mode isn't gibberish, it's slightly worse reasoning on the hard cases."

### VRAM budget

The accounting exercise that determines whether a deployment actually works: everything that must live in [VRAM](#vram) at once, added up and compared against the card. Four things compete for the same fixed number.

| Component                             | What sets it                                                    | How it scales         |
| ------------------------------------- | --------------------------------------------------------------- | --------------------- |
| [Model weights](#model-weights) | [Parameter count](#parameter-count) × bytes per parameter | Fixed once loaded     |
| [KV cache](#kv-cache)           | Sequence length × [concurrency](#concurrency)               | Grows with traffic    |
| Activations                           | Model architecture, [batch size](#batch-size)             | Grows with batch      |
| Runtime overhead                      | CUDA context, kernels, buffers, fragmentation                   | Roughly fixed, 1–3 GB |

Only the first is what people check. The habit worth breaking is treating "the model fits" as the answer — weights are a one-time cost paid at load, and the memory left over after that is what determines how many users you can serve. A 70B model quantized onto an 80 GB card might leave 20 GB free; that 20 GB, minus overhead, is the deployment's real capacity, and it is what [KV cache capacity](#kv-cache-capacity) measures.

The failure this predicts is the characteristic one. A deployment loads cleanly, serves a demo perfectly, then falls over in production — because the demo was one request and production is forty, each holding its own cache. The [OOM](#oom) arrives under load, not at startup, which makes it look like a stability problem rather than an arithmetic one.

Reserve headroom deliberately rather than filling the card. Engines usually expose a fraction of VRAM they are allowed to claim; leaving nothing spare means the first unusually long request takes the service down.

_Usage:_

"It loads with four gigs to spare, so we're fine."

"Four gigs is your entire KV cache budget. At 8k contexts that's a handful of concurrent requests before it starts queueing or dying."

### CPU offload

Keeping part of a model — usually some layers of the [model weights](#model-weights), sometimes the [KV cache](#kv-cache) — in system RAM instead of [VRAM](#vram), and moving it across the PCIe bus when it is needed.

It works, and it is very slow. The reason is bandwidth. On-card [HBM](#hbm) runs at several terabytes per second; PCIe Gen5 runs at roughly 60 GB/s, two orders of magnitude less. Since [decode](#decode) is [memory bound](#memory-bound) and reads every weight it uses once per [token](#token), any layer that has to cross that bus dominates the time for the whole step. Offloading a modest fraction of a model does not cost a modest fraction of the speed; it can cost most of it.

That makes offload a tool for a specific situation rather than a general technique. It is genuinely useful for getting a model running at all on hardware that cannot hold it — local experimentation, a one-off batch job, a development environment where correctness matters and latency does not. It is a poor answer to a production capacity problem, where [quantization](#quantization) or [tensor parallelism](#tensor-parallelism) address the same shortfall without giving up the memory hierarchy.

The symptom when it is on unintentionally is distinctive: generation that is many times slower than the card should manage, with [GPU utilization](#gpu-utilization) low and steady rather than saturated. Some engines enable offload automatically when a model does not fit, so a deployment can end up in this state without anyone choosing it.

_Usage:_

"It's running, but at three tokens a second on an A100."

"Check whether it silently offloaded layers to CPU when it didn't fit. You're paying PCIe bandwidth per token — quantize it instead so it fits properly."

### OOM

**Out of memory.** The failure that occurs when an allocation cannot be satisfied because there is not enough free [VRAM](#vram). On a GPU it is generally fatal to the request and often to the [worker](#worker) process, since the runtime has no way to shed memory and continue.

The timing is what makes OOM confusing. A deployment that OOMs at startup has an obvious problem: the [model weights](#model-weights) do not fit and the [VRAM budget](#vram-budget) was wrong. Far more common is the deployment that starts cleanly, serves traffic for hours, and then dies — because the weights were only the fixed part of the budget, and the [KV cache](#kv-cache) grows with every additional concurrent request and every additional [token](#token) of context. The service did not become unstable; it met its actual peak for the first time.

Two patterns account for most production OOMs. One is a [concurrency](#concurrency) limit set above what [KV cache capacity](#kv-cache-capacity) can support, so a traffic spike admits more requests than there is memory for. The other is an unusually long request — someone pastes a large document — expanding one cache far beyond the typical size. Both are capacity planning failures rather than bugs.

The fixes are the levers from elsewhere in this dictionary: [quantize](#quantization) to shrink the weights, cap the [context window](#context-window) to bound worst-case cache per request, lower the concurrency limit so the engine queues instead of dying, or move to a card with more memory. Fragmentation used to be a third cause; [PagedAttention](#pagedattention) largely removed it.

_Usage:_

"It OOMs maybe twice a day, always in the afternoon."

"That's your peak traffic, not a leak. The concurrency limit is above what the KV cache can hold — lower it and requests queue instead of the worker dying."

## Section 4 — How a Request Is Served

### Inference engine

The software that loads [model weights](#model-weights) onto a [GPU](#gpu) and turns incoming requests into [forward passes](#forward-pass). It owns the scheduler, the [KV cache](#kv-cache), the batching strategy, and the [CUDA](#cuda) kernels — which makes engine choice roughly as consequential as hardware choice.

Running a model with plain PyTorch works and is several times slower than it needs to be, because none of the serving-specific machinery is there: no [continuous batching](#continuous-batching), no paged cache allocation, no [prefix caching](#prefix-caching), no [speculative decoding](#speculative-decoding). Those are the optimizations that separate a demo from a deployment, and they live here rather than in the model.

| Engine            | Optimizes for                       | Notes                                                                        |
| ----------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| [vLLM](#vllm) | Throughput on NVIDIA GPUs           | The common default. PagedAttention, continuous batching, wide model support. |
| TensorRT-LLM      | Peak NVIDIA performance             | Compiles per model and GPU. Fastest, least flexible, slow to build.          |
| SGLang            | Structured and multi-turn workloads | Strong prefix caching; good where prompts share long prefixes.               |
| TGI               | Hugging Face integration            | Straightforward operationally, closely tracks the hub.                       |
| llama.cpp         | Local and quantized use             | CPU and consumer GPUs, GGUF weights. Not aimed at high concurrency.          |

Most expose an [OpenAI-compatible API](#openai-compatible-api), so the engine is usually swappable without touching client code — which makes it worth running a [benchmark](#benchmark) on two of them against your own [workload shape](#workload-shape) rather than accepting a published comparison.

Engines also determine [cold start](#cold-start) behaviour. Ones that compile or capture graphs at startup trade a slower launch for faster steady-state serving, which matters a great deal if [workers](#worker) are created and destroyed frequently.

_Usage:_

"We're serving it with a FastAPI wrapper around transformers."

"That's leaving most of the card on the floor. vLLM will do several times the throughput on the same GPU, mostly from continuous batching."

### vLLM

An open-source [inference engine](#inference-engine) for large language models, and the default choice for most self-hosted serving. It came out of Berkeley research into how badly the [KV cache](#kv-cache) was being managed, and the answer it produced — [PagedAttention](#pagedattention) — is now in nearly every competing engine.

The problem it identified was allocation, not computation. Engines at the time reserved a contiguous block of [VRAM](#vram) per request, sized for the maximum possible sequence length. A request that generated 200 [tokens](#token) against a 4,096-token reservation wasted most of it, and the waste was multiplied by every concurrent request. PagedAttention allocates the cache in small fixed blocks instead, the way an operating system pages memory, so a request only holds what it actually uses. The recovered memory translates directly into [KV cache capacity](#kv-cache-capacity), and from there into [concurrency](#concurrency) and [throughput](#throughput).

Around that sits the rest of what makes it useful: [continuous batching](#continuous-batching) so finished requests leave the batch immediately and waiting ones join, [prefix caching](#prefix-caching) for shared prompt beginnings, [chunked prefill](#chunked-prefill) to stop long prompts stalling generation, [tensor parallelism](#tensor-parallelism) across GPUs, [quantization](#quantization) support, and an [OpenAI-compatible API](#openai-compatible-api) so it drops in behind existing clients.

It is not always the fastest. TensorRT-LLM generally wins on raw NVIDIA throughput if you are willing to compile per model and per GPU, and SGLang can win where prompts share very long prefixes. vLLM's advantage is that it is fast, general, and supports new models quickly.

_Usage:_

"Why does everyone reach for vLLM first?"

"Continuous batching and PagedAttention out of the box, and it supports new models within days. You'd need a specific reason to start anywhere else."

### Forward pass

One run of input through the model's layers to produce output. It is the unit of work that inference consists of, and everything measured in this dictionary is ultimately counting forward passes or the [tokens](#token) they produce.

Mechanically it is a sequence of large matrix multiplications interleaved with attention. The input tokens are turned into vectors, and each layer transforms them in turn, reading the [model weights](#model-weights) for that layer as it goes. Attention layers additionally compare tokens against one another, which is where the [KV cache](#kv-cache) is read and written. The final layer produces a probability distribution over the [tokenizer](#tokenizer) vocabulary, and one token is selected from it.

The same operation behaves like two different workloads depending on how many tokens it processes at once. A pass over a whole prompt has thousands of tokens of parallel work and saturates the arithmetic units, which is [prefill](#prefill) and is [compute bound](#compute-bound). A pass producing a single next token has almost no parallel work and spends its time reading weights, which is [decode](#decode) and is [memory bound](#memory-bound). Recognising that one mechanism has these two regimes explains most of what looks inconsistent about inference performance.

No state persists between passes except the KV cache. The weights are read-only, so nothing a request does can affect another, which is what makes batching and replication straightforward.

_Usage:_

"Is generating 500 tokens one operation or 500?"

"500 forward passes, one per token, each reading the whole model. That's why output length drives cost far more than input length does."

### Prefill

The first stage of a request, where the model processes every input [token](#token) and builds the [KV cache](#kv-cache) entries for them. It ends when the first output token appears, which makes it the thing [TTFT](#ttft) is measuring.

Prefill can process the entire prompt at once, because all of the input is already known. That gives the [GPU](#gpu) a large matrix multiplication with plenty of parallel work, which saturates the arithmetic units and makes prefill [compute bound](#compute-bound). Its cost grows with prompt length: doubling the prompt roughly doubles prefill time, so long-context requests are slow to start even when they generate quickly afterwards.

[Decode](#decode), the stage that follows, behaves the opposite way in nearly every respect:

|                  | Prefill                    | Decode                                      |
| ---------------- | -------------------------- | ------------------------------------------- |
| Processes        | The whole prompt at once   | One token at a time                         |
| Parallelism      | High — all tokens together | Low — inherently sequential                 |
| Bottleneck       | Arithmetic                 | [Memory bandwidth](#memory-bandwidth) |
| Scales with      | Input length               | Output length                               |
| Metric it drives | TTFT                       | [TPOT](#tpot)                           |

The two stages competing for the same GPU is a live scheduling problem rather than a theoretical one. A long prefill arriving mid-batch stalls everyone else's generation, which users experience as output that stutters for reasons unrelated to their own request. [Chunked prefill](#chunked-prefill) is the standard answer: break the prompt into pieces so prefill and decode interleave. [Prefix caching](#prefix-caching) attacks it from the other side, skipping prefill entirely for the portion of a prompt that has been seen before.

_Usage:_

"First token takes four seconds, then it's quick."

"That's prefill. Your prompts are long and it processes all of them before it can start. If they share a system prompt, turn on prefix caching."

### Decode

The stage where the model generates output, one [token](#token) at a time. Each token is produced, appended to the sequence, and fed back in to produce the next, until the model emits a stop token or hits a length limit.

Decode is sequential by construction — token 50 cannot be computed before token 49 exists. That makes it the opposite of [prefill](#prefill) in how it uses hardware. There is almost no parallel work in a single request's decode step, so the [GPU](#gpu) spends its time reading the [model weights](#model-weights) out of [VRAM](#vram) rather than doing arithmetic. It is [memory bound](#memory-bound), and its speed is set by [memory bandwidth](#memory-bandwidth) rather than by compute.

That single fact explains most of the counterintuitive behavior in serving. Generating for one user leaves the GPU mostly idle, because the weights get read once per token no matter how many requests ride along. Batching many requests together amortizes that read across all of them, so [throughput](#throughput) climbs steeply with [batch size](#batch-size) while per-user speed barely moves. It also explains why a smaller or [quantized](#quantization) model generates faster: there are simply fewer bytes to move per token, and why [speculative decoding](#speculative-decoding) can work at all — the idle arithmetic capacity is already paid for.

Every decoded token adds to the [KV cache](#kv-cache), so long generations grow their own memory footprint as they run. The user-visible pace of decode is [TPOT](#tpot), and under [streaming](#streaming) it is what a response feels like once it has begun.

_Usage:_

"One request runs at 40 tokens a second and the GPU reads 20% busy. Are we wasting the card?"

"Decode is memory bound, so yes — a single stream can't fill it. Batch more requests and throughput goes up several times over at roughly the same per-user speed."

### Streaming

Returning generated [tokens](#token) to the client as they are produced rather than waiting for the complete response. The connection stays open and each token is pushed as [decode](#decode) emits it, usually over server-sent events.

It changes what the user waits for, and nothing else. Without streaming, the wait is the whole response: [prefill](#prefill) plus every token of generation, which for a long answer is many seconds of blank screen. With streaming, the wait is [TTFT](#ttft) alone, and after that text arrives continuously at the rate given by [TPOT](#tpot). Total time is identical. Perceived speed is not remotely identical, which is why interactive products stream by default.

Streaming also changes which metrics matter. Once output is visible as it arrives, end-to-end latency stops describing user experience and the pair of TTFT and TPOT starts. It is worth noting that a fast average with occasional long stalls feels worse than a uniformly slower stream, so the [tail](#tail-latency) of inter-token gaps deserves attention rather than just the mean. Those stalls usually come from another request's long prefill occupying the GPU, which is the problem [chunked prefill](#chunked-prefill) addresses.

Operationally it has costs. Connections are long-lived, so [timeouts](#timeout), proxies and load balancers all need configuring for it, and a client that disconnects mid-stream should cancel the request rather than leaving it generating into nothing — otherwise it keeps consuming [KV cache](#kv-cache) and a [worker](#worker) slot for no one.

_Usage:_

"Users say it feels slow, but our p50 latency is fine."

"Are you streaming? If they're waiting for the full response, they're feeling total generation time. Stream it and they wait for the first token instead."

### OpenAI-compatible API

An HTTP interface that follows the request and response shapes OpenAI established — `/v1/chat/completions` taking a list of role-tagged messages, returning choices, and streaming deltas over server-sent events. Most [inference engines](#inference-engine) and most hosted providers expose one.

Its value is that it decouples the client from the deployment. Application code written against it can point at a hosted provider, a self-hosted [vLLM](#vllm) instance, or a different engine entirely, by changing a base URL. That makes engine benchmarking cheap, gives you a fallback path when capacity runs short, and means the decision about where inference runs is not baked into the product. It also means the existing client libraries, retry logic and tooling all work unmodified.

Compatibility is a spectrum rather than a guarantee. The core chat and completion endpoints are reliable across implementations. Beyond that, support for tool calling, structured output, log probabilities, and the exact error and usage fields varies by engine and version. Anything outside the basic request path is worth verifying rather than assuming.

One detail matters more than it looks. The engine applies the model's chat template to turn the message list into the string the model expects, using the model's own config — see [tokenizer](#tokenizer). Sending pre-formatted text through the plain completions endpoint instead bypasses that, and it is an easy way to get quietly worse output from a correctly deployed model.

_Usage:_

"Can we test whether the self-hosted setup is good enough before committing?"

"Both speak the OpenAI API, so point the base URL at yours and run the same eval. Nothing else in the client changes."

## Section 5 — What You Measure

### Latency

How long an operation takes. On its own the word is too coarse to act on, because an inference request's total time is the sum of several stages with different causes and different fixes.

| Stage      | What it is                | What it scales with                                      | How to reduce it                                                                   |
| ---------- | ------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Queue      | Waiting for capacity      | [Concurrency](#concurrency) above what memory allows | More [KV cache capacity](#kv-cache-capacity), more [workers](#worker)  |
| Scheduling | Waiting to join a batch   | Engine scheduling policy                                 | [Continuous batching](#continuous-batching)                                  |
| Prefill    | Processing the input      | Prompt length                                            | [Prefix caching](#prefix-caching), [chunked prefill](#chunked-prefill) |
| Decode     | Generating the output     | Output length                                            | [Memory bandwidth](#memory-bandwidth), [quantization](#quantization)     |
| Network    | Client to server and back | Distance, payload                                        | Region placement                                                                   |
| Cold start | Provisioning a new worker | Whether one was warm                                     | [Scale to zero](#scale-to-zero) settings, [FlashBoot](#flashboot)      |

End-to-end latency is all of these together. Splitting it is what makes a slow deployment diagnosable: a request that is slow because of queueing needs different treatment entirely from one that is slow because the prompt is long, and both look identical from the client.

Under [streaming](#streaming) the total stops being the number that matters, because the user starts reading before it elapses. The pair that describes the experience is [TTFT](#ttft), covering everything up to the first token, and [TPOT](#tpot) for the pace after that.

Latency also trades against [throughput](#throughput). Larger batches make better use of the [GPU](#gpu) and make each request slightly slower. Which one to favour is a product decision, not a technical one.

_Avoid:_ quoting a latency figure without a percentile. An average hides exactly the requests users complain about — see [tail latency](#tail-latency).

_Usage:_

"Latency went up 40% this week."

"Which part? If it's TTFT the prompts got longer or you're queueing. If it's the inter-token gap, that's batch pressure. Different fixes."

### TTFT

**Time to first token.** The delay between sending a request and receiving the first generated [token](#token). Under [streaming](#streaming) it is the only wait a user actually experiences before text starts appearing, which makes it the headline metric for anything interactive.

It is a sum rather than a single thing, and that is what makes it diagnosable. TTFT covers network time out, any time spent in the queue waiting for capacity, the scheduling delay before the request joins a batch, and then [prefill](#prefill) over the whole prompt. If a [worker](#worker) had to be provisioned it also includes the entire [cold start](#cold-start), which is why the first request after an idle period can be seconds slower than every one after it.

Which component dominates tells you what to fix. TTFT that scales with prompt length is prefill, and the answers are [prefix caching](#prefix-caching) when requests share a beginning, or a card with more arithmetic. TTFT that scales with traffic rather than prompt size is queueing, which means [concurrency](#concurrency) is above what [KV cache capacity](#kv-cache-capacity) supports and requests are waiting for memory. TTFT that is fine at [p50](#tail-latency) and terrible at p99 usually means occasional cold starts or occasional very long prompts.

Note that raising [batch size](#batch-size) to improve [throughput](#throughput) generally worsens TTFT, since a new request waits longer for its turn. That trade is the central tuning decision in interactive serving.

_Usage:_

"Median TTFT is 300ms but p99 is 9 seconds."

"That's cold starts. Your p99 requests are landing on workers that had to boot — either keep one warm or cut the model load time."

### TPOT

**Time per output token.** The average time to produce each token after generation has begun, sometimes called inter-token latency. Where [TTFT](#ttft) is how long the user waits to see anything, TPOT is how fast text arrives once it does.

It is set almost entirely by [decode](#decode), which means it is set by [memory bandwidth](#memory-bandwidth). Producing a token requires reading the [model weights](#model-weights) involved out of [VRAM](#vram), so a larger model has a higher TPOT on the same card, and [quantization](#quantization) lowers it by shrinking the bytes to move. Extra arithmetic capacity does not help, which surprises people who upgrade for compute and see no change.

The useful reference point is reading speed. A comfortable reading pace is roughly 5 to 10 tokens per second, so TPOT below about 100ms already outpaces the user and further gains stop being felt. This is what makes TPOT a threshold metric rather than one to optimize indefinitely: past the point where output arrives faster than it can be read, [throughput](#throughput) is the better thing to spend capacity on.

Batching is where the trade shows up. Adding requests to a batch increases TPOT slightly for everyone while increasing total throughput a great deal, so the right [batch size](#batch-size) is the largest one that keeps TPOT under your threshold. At low concurrency, where the card is underused, [speculative decoding](#speculative-decoding) can cut TPOT outright by producing several tokens per pass. Averages also hide the thing users notice: a steady stream with occasional multi-second stalls reads worse than a uniformly slower one, and those stalls are usually another request's long [prefill](#prefill) — the problem [chunked prefill](#chunked-prefill) exists to solve.

_Usage:_

"Should we push batch size higher? Throughput's still climbing."

"Watch TPOT as you go. Once tokens arrive slower than people read, you're trading visible smoothness for throughput nobody asked for."

### Throughput

How much work a deployment completes per unit of time. For inference this is usually total [tokens](#token) per second across every in-flight request, and sometimes requests per second when request sizes are comparable.

Throughput and [latency](#latency) are different questions, and they often move in opposite directions. Batching more requests together raises throughput substantially, because [decode](#decode) is [memory bound](#memory-bound) and the [model weights](#model-weights) get read once for the whole batch instead of once per request. It also makes each individual request slightly slower. A configuration tuned purely for throughput has excellent aggregate numbers and unhappy users; one tuned purely for latency leaves most of the [GPU](#gpu) idle.

The number means nothing without the conditions that produced it. Tokens per second at [concurrency](#concurrency) one and at concurrency 64 can differ by more than an order of magnitude on identical hardware, and prefill tokens and decode tokens cost very different amounts to produce. A throughput figure needs its [workload shape](#workload-shape) attached before it can be compared to anything, which is what a [concurrency sweep](#concurrency-sweep) exists to produce.

Throughput is also the denominator that turns an hourly rate into a real cost. A [GPU hour](#gpu-hour) price on its own says nothing; price divided by tokens per second is [cost per million tokens](#cost-per-million-tokens), and that is the comparison that decides which card is actually cheaper. Pushing throughput past the point where latency targets break is measured by [goodput](#goodput) instead.

_Avoid:_ quoting "tokens per second" without saying whether it is per request or aggregate, and at what concurrency. The two readings differ by the [batch size](#batch-size).

_Usage:_

"We're getting 2,000 tokens a second, that sounds healthy."

"At what concurrency, and how much of it is prefill? Aggregate throughput on long prompts isn't comparable to the number you measured last week."

### Tail latency

The [latency](#latency) experienced by the slowest portion of requests, described by percentiles rather than by an average. It is where most real complaints live, and it is invisible in a mean.

| Measure | Meaning                     | Who feels it                          |
| ------- | --------------------------- | ------------------------------------- |
| p50     | Half of requests are faster | The typical request. What demos show. |
| p95     | 1 in 20 is slower           | Noticeable to regular users           |
| p99     | 1 in 100 is slower          | Every heavy user, several times a day |
| p99.9   | 1 in 1,000 is slower        | Timeouts, retries, support tickets    |

The reason percentiles diverge under load is structural. Once [concurrency](#concurrency) exceeds what [KV cache capacity](#kv-cache-capacity) supports, some requests run immediately and others wait, so the distribution grows a long right tail while the median barely moves. A dashboard showing average latency can look flat through exactly the period where a meaningful share of users are having a bad time.

Aggregation makes this worse in a specific way worth knowing: percentiles cannot be averaged. The mean of per-minute p99s is not the p99 of the hour, and it is systematically optimistic. Compute percentiles over the raw distribution.

In inference the tail usually has a small number of causes. [Cold starts](#cold-start) put whole seconds into a few requests. Unusually long prompts inflate [prefill](#prefill) for themselves and stall the batch for others. Queueing at peak stretches everything. And [retries](#timeout) against an already-saturated service add load precisely when it is least able to absorb it.

_Avoid:_ reporting an average latency at all when the distribution is skewed. Quote p50 and p99 together — the gap between them is the interesting number.

_Usage:_

"Average response time is 800ms, that's within target."

"What's p99? If it's twelve seconds, one request in a hundred is timing out and the average is telling you nothing about it."

### Goodput

The rate of work that is both completed and useful — [throughput](#throughput) counted only where it satisfies the latency requirements attached to it. Requests served too slowly to matter are counted as capacity spent, not capacity delivered.

The distinction exists because raw throughput can always be increased by making everyone wait. Push [batch size](#batch-size) and [concurrency](#concurrency) limits high enough and total tokens per second keeps climbing while [TTFT](#ttft) stretches to ten seconds and [TPOT](#tpot) falls below reading pace. The dashboard improves; the product gets worse. Goodput is what stops that trade from looking like a win.

Measuring it requires stating the targets first — for example, TTFT under one second and TPOT under 100ms — and then counting only the tokens from requests that met them. Plotted against concurrency, the two curves separate in a way that is immediately useful: throughput rises and then flattens, while goodput rises, peaks, and falls as the tail crosses the threshold. The peak of the goodput curve is the concurrency limit worth configuring, and it usually sits well below where throughput stops improving.

This is also the number that makes [saturation](#saturation) concrete. Past the goodput peak, added load produces requests that are technically served and practically useless, plus a growing share of clients that give up and [retry](#timeout), which adds still more load.

_Usage:_

"We can push to 128 concurrent before throughput flattens out."

"Throughput flattens there, but goodput peaked at 48 — past that you're serving requests slower than the SLA, so you're paying for work nobody accepts."

## Section 6 — The KV Cache & Batching

### KV cache

The stored attention keys and values for every [token](#token) a request has already processed. It exists so that producing the next token doesn't require recomputing the whole sequence, and it is the largest variable consumer of [VRAM](#vram) in a running deployment.

Attention works by comparing each token against every token before it. Without a cache, producing token 1,000 would mean redoing the work for tokens 1 through 999, and the cost of a response would grow with the square of its length. Caching the keys and values turns each new token into a comparison against stored state instead: linear, not quadratic. This is what makes [decode](#decode) practical at all.

The cost is memory, and it scales in a way that surprises people. The cache grows with sequence length, with the number of simultaneous requests, and with model size, and every byte of it competes with the [model weights](#model-weights) for the same fixed VRAM. A deployment that loads comfortably can still fall over under load, because the weights are a fixed cost and the cache is not. How much of it you can hold is [KV cache capacity](#kv-cache-capacity), and that is the number that really sets your [concurrency](#concurrency).

Because it is both large and unpredictable, the cache is where most [inference engine](#inference-engine) optimization is aimed: [PagedAttention](#pagedattention) to allocate it without waste, [prefix caching](#prefix-caching) to reuse it across requests, [KV cache quantization](#kv-cache-quantization) to shrink it, and [eviction](#kv-cache-eviction) for when there is no room left.

_Usage:_

"Memory climbs all afternoon and then it OOMs. The model isn't changing."

"That's KV cache, not weights. More concurrent requests and longer conversations both grow it — you're running out of the headroom left after load."

### KV cache capacity

How much [KV cache](#kv-cache) the memory left after loading can hold, expressed as total [tokens](#token) across all in-flight requests. It is the number that actually determines how many users a deployment serves, and the one people skip.

The arithmetic is straightforward. Take the card's [VRAM](#vram), subtract the [model weights](#model-weights), subtract runtime overhead, and divide what remains by the per-token cache cost of the model. Divide that by the typical sequence length and you have your [concurrency](#concurrency) ceiling — the point past which requests queue rather than run.

Which makes the causal chain concrete: a longer [context window](#context-window) means more cache per request, which means fewer concurrent requests, which means lower [throughput](#throughput) on the same hardware, which means a higher [cost per million tokens](#cost-per-million-tokens). Nothing about the GPU changed. This is why "the model fits" and "the deployment works" are different claims, and it is what a [VRAM budget](#vram-budget) is for.

Every lever available acts on one term of that division:

| Lever                                                       | Effect on capacity          | Cost                        |
| ----------------------------------------------------------- | --------------------------- | --------------------------- |
| Shorter max context                                         | Fewer tokens per request    | Truncates long inputs       |
| [Quantize](#quantization) the weights                   | More free VRAM              | Some accuracy               |
| [KV cache quantization](#kv-cache-quantization)     | Cheaper per token           | Some accuracy               |
| Add a GPU ([tensor parallelism](#tensor-parallelism)) | More total VRAM             | Communication overhead      |
| [PagedAttention](#pagedattention)                       | Removes reservation waste   | None, it is strictly better |
| [Prefix caching](#prefix-caching)                     | Shared prefixes stored once | Only helps shared prompts   |

_Usage:_

"How many concurrent users can this handle?"

"Free VRAM after load, divided by cache-per-token, divided by your average sequence length. Not a number you can guess from the GPU model."

### PagedAttention

A memory management technique for the [KV cache](#kv-cache) that allocates it in small fixed-size blocks rather than as one contiguous region per request. Introduced by [vLLM](#vllm) and since adopted almost everywhere.

The problem it solves is waste, not speed. Engines used to reserve cache for each request sized to the maximum sequence it might reach — if the [context window](#context-window) allowed 4,096 [tokens](#token), each request reserved 4,096 tokens of [VRAM](#vram) whether it used them or not. A request that generated 200 tokens held 95% of its reservation empty, multiplied across every concurrent request. Measurements at the time put usable cache utilization around 20 to 40 percent.

Blocks fix that the way an operating system's virtual memory does. The cache is carved into uniform blocks of a few tokens each, a request is handed blocks as it grows, and a per-request block table maps logical positions to wherever those blocks physically sit. Nothing needs to be contiguous, so a request holds only what it has actually used, and memory fragmentation — previously a real source of [OOM](#oom) — largely disappears.

The recovered memory is the point: it becomes [KV cache capacity](#kv-cache-capacity), which becomes [concurrency](#concurrency), which becomes [throughput](#throughput). Paging also makes two other things cheap. [Prefix caching](#prefix-caching) works by letting several requests point at the same physical blocks for a shared prompt beginning, and [eviction](#kv-cache-eviction) becomes a matter of reclaiming individual blocks rather than whole requests.

_Usage:_

"Is PagedAttention something we need to turn on?"

"It's the default in any current engine. The thing to know is that it's why your effective concurrency is several times what naive reservation would give you."

### KV cache eviction

Removing cached attention state to free [VRAM](#vram) when there is not enough for the requests currently in flight. It is what an [inference engine](#inference-engine) does instead of an [OOM](#oom), and it is not free.

Eviction happens because the [KV cache](#kv-cache) grows unpredictably. Requests do not announce how long their output will be, so an engine admits work based on an estimate and can find itself over-committed when several requests all generate more than expected. At that point something has to give.

Engines have two options and use both. Preemption suspends a request and discards its cache entirely; when it resumes, the discarded state has to be rebuilt by re-running [prefill](#prefill) over everything it had already processed. Swapping copies the cache to system RAM instead and copies it back, which avoids recomputation but pays PCIe transfer time in each direction — the same bandwidth problem that makes [CPU offload](#cpu-offload) slow. Cached prefixes from [prefix caching](#prefix-caching) are usually evicted first, since they are an optimization rather than live state.

The symptom is distinctive and easy to misread. [Throughput](#throughput) drops while [GPU utilization](#gpu-utilization) stays high, because the card is busy redoing work it already did. [Tail latency](#tail-latency) gets much worse for the preempted requests specifically, since they effectively start over. It looks like the model got slower; what actually happened is that [concurrency](#concurrency) exceeded [KV cache capacity](#kv-cache-capacity) and the engine is thrashing.

Frequent eviction is a sizing signal, not something to tune around. Admit fewer requests, shorten the [context window](#context-window), or add memory.

_Usage:_

"Throughput collapsed at peak but the GPU still shows fully busy."

"Check the engine's preemption counter. If it's evicting, it's re-prefilling the same requests over and over — you're admitting more than the cache can hold."

### Prefix caching

Reusing the [KV cache](#kv-cache) computed for the beginning of one request when a later request starts with the same [tokens](#token). The shared portion skips [prefill](#prefill) entirely and is read from memory instead of recomputed.

It works because attention state for a token depends only on the tokens before it. If two requests share their first 2,000 tokens, the cache entries for those tokens are identical, so the second request can point at the same blocks — which is why [PagedAttention](#pagedattention) made this cheap to implement. The match has to be an exact prefix; a single differing token at position 5 invalidates everything after it.

The gain is large in exactly the situations production workloads are made of. A system prompt shared across every request is prefilled once for the entire deployment. A multi-turn conversation re-sends the whole history on each turn, so every turn after the first is a prefix hit for everything except the newest message. Retrieval-augmented requests that share a document set hit on the retrieved context. In these cases [TTFT](#ttft) drops from seconds to near-immediate and the [compute bound](#compute-bound) prefill work largely disappears.

Two things break it, and both are easy to do accidentally. Putting anything variable at the front of the prompt — a timestamp, a session ID, a per-user greeting — moves the divergence point to position zero and the cache never hits. And cached blocks are [evicted](#kv-cache-eviction) under memory pressure, so a busy deployment may lose entries it would have reused. Order prompts with the stable content first and the variable content last.

_Usage:_

"Prefix caching is on but the hit rate is basically zero."

"Something variable is at the top of the prompt. Move the timestamp to the end and put the system prompt first — it only matches exact prefixes."

### KV cache quantization

Storing the [KV cache](#kv-cache) at reduced [precision](#precision) — typically FP8 or INT8 instead of the model's native 16-bit — so each cached [token](#token) costs half the memory or less.

It is a distinct decision from [quantization](#quantization) of the [model weights](#model-weights), and the two are configured separately. Weight quantization reduces the fixed cost paid once at load; cache quantization reduces the variable cost paid per token of every in-flight request. Which one helps more depends on where your memory is actually going. A small model serving very long contexts can easily spend more [VRAM](#vram) on cache than on weights, and in that case quantizing the cache is the larger win by a wide margin.

The effect goes straight through to capacity. Halving the per-token cost doubles [KV cache capacity](#kv-cache-capacity) for the same free memory, which doubles the [concurrency](#concurrency) ceiling, which raises [throughput](#throughput) and lowers [cost per million tokens](#cost-per-million-tokens). It also reduces the bytes read per attention step, which helps [decode](#decode) slightly since that is [memory bound](#memory-bound).

Quality behaves differently from weight quantization and deserves its own evaluation. Errors in cached keys and values accumulate along a sequence rather than staying local, so degradation tends to show up on long contexts specifically — the case you probably enabled it for. FP8 is generally safe in practice; INT4 caches are noticeably risky. Test on your longest realistic inputs, not your typical ones.

_Usage:_

"We quantized the weights and still can't get concurrency up."

"At 32k contexts your cache is bigger than your weights. Quantize the KV cache to FP8 — that's where the memory actually is."

### Batch size

The number of sequences an [inference engine](#inference-engine) processes together in a single step. It is the main lever on the trade between [throughput](#throughput) and [latency](#latency).

Batching pays because [decode](#decode) is [memory bound](#memory-bound). Producing a token requires reading the [model weights](#model-weights) out of [VRAM](#vram), and that read serves every sequence in the batch at once. Going from one sequence to sixteen costs barely more time per step but produces sixteen times the [tokens](#token), so throughput climbs steeply while [TPOT](#tpot) rises only slightly. This is the single largest efficiency gain available in serving, and it is why an unbatched deployment wastes most of the [GPU](#gpu).

The gain does not continue indefinitely. Two limits arrive: memory, when the batch's combined [KV cache](#kv-cache) exceeds [KV cache capacity](#kv-cache-capacity), and compute, when enough sequences are in flight that the arithmetic units saturate and the workload stops being memory bound. Past either point, larger batches add latency without adding throughput — [saturation](#saturation).

Under [continuous batching](#continuous-batching), which is now standard, batch size is not a number you set directly. Sequences join and leave the running batch as they arrive and finish, so the effective batch fluctuates constantly and what you actually configure is a maximum, plus how much memory the engine may claim. The engine fills the batch as far as those limits allow.

_Avoid:_ using it interchangeably with [concurrency](#concurrency). Concurrency is how many requests are in the system, including those queued; batch size is how many are in the current step.

_Usage:_

"What batch size should we set?"

"With continuous batching you set the ceiling, not the value. Raise the max and the memory fraction until TPOT hits your limit, then stop."

### Continuous batching

A scheduling approach where sequences enter and leave the in-flight batch independently, rather than being grouped before execution and held together until all of them finish. It is the default in every current [inference engine](#inference-engine) and the single biggest reason modern serving outperforms naive serving.

The problem it solves is idle time created by variance. Generation lengths differ enormously — one request answers in 20 [tokens](#token), another in 800 — and older approaches had to keep the whole batch running until the longest finished:

| Approach   | How a request joins                                     | Cost                                                                       |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Static     | Fixed group assembled before execution                  | Whole batch waits for the slowest; short requests hold slots doing nothing |
| Dynamic    | Group assembled from whatever has arrived by a deadline | Removes the wait to fill, keeps the wait to finish                         |
| Continuous | Any step, as slots free                                 | Neither wait; the batch is refilled every step                             |

Because a [forward pass](#forward-pass) in [decode](#decode) produces exactly one token per sequence, the batch can be recomposed between every step at almost no cost. A finished sequence releases its slot and its [KV cache](#kv-cache) immediately, and a queued request takes its place on the next step. The [GPU](#gpu) stays full even under highly variable traffic, which raises [throughput](#throughput) several times over on realistic workloads.

Two consequences follow. [Batch size](#batch-size) stops being a number you set and becomes a ceiling the engine fills. And [TTFT](#ttft) improves as well as throughput, since an arriving request waits at most one decode step rather than for a batch to assemble.

_Usage:_

"Half the batch finishes early and the GPU sits idle until the long one is done."

"That's static batching. Any current engine does continuous batching — finished sequences drop out and queued ones take their slot on the next step."

### Chunked prefill

Breaking [prefill](#prefill) for a long prompt into several smaller pieces, processed across multiple steps and interleaved with ongoing [decode](#decode), instead of running the whole prompt in one uninterruptible block.

The problem is a scheduling collision between two workloads with opposite shapes. Prefill is [compute bound](#compute-bound) and can occupy the [GPU](#gpu) for hundreds of milliseconds on a long prompt. Decode is [memory bound](#memory-bound) and needs to run every few milliseconds to keep streams moving. When a 30,000-token prompt arrives, an engine without chunking runs that prefill to completion, and every request currently generating stops dead for its duration. Users who were mid-response watch their [streaming](#streaming) output freeze for reasons entirely unrelated to their own request.

Chunking caps how much prefill work any single step may contain. A long prompt is processed over several steps, and each of those steps also carries the decode work for everyone else. The long request's own [TTFT](#ttft) gets slightly worse, since its prefill is now spread out; everybody else's [TPOT](#tpot) stops spiking. Given that the alternative concentrates the pain on innocent requests, this is almost always the right trade for interactive serving.

There is a throughput cost to weigh. Splitting prefill means the arithmetic units are less fully saturated in each step, so a batch-processing workload with no latency requirement may be better off without it. The distinction is whether anyone is waiting on a stream.

_Usage:_

"Whenever someone submits a big document, everyone else's output stutters."

"One long prefill is blocking the decode steps. Turn on chunked prefill and cap the per-step token budget — it interleaves instead of monopolising."

### Speculative decoding

Generating several candidate [tokens](#token) quickly with a cheap method, then verifying them all in a single [forward pass](#forward-pass) of the real model. Accepted guesses are kept, so one pass can yield several tokens instead of one.

It works because of the asymmetry [decode](#decode) creates. Decode is [memory bound](#memory-bound): a pass spends its time reading [model weights](#model-weights) out of [VRAM](#vram) and leaves most of the arithmetic units idle. Checking five proposed tokens in that pass costs almost nothing extra, because the expensive part — moving the weights — happens either way. The spare compute is already paid for.

A draft model produces the guesses: a much smaller model, or a compressed head attached to the main one, fast enough that generating several candidates is cheap. The target model then verifies them in one pass, accepting the longest prefix that matches what it would have produced itself. Crucially the output is identical to unassisted generation — verification rejects anything the target would not have chosen, so this is a latency optimization, not a quality trade.

The gain depends entirely on the acceptance rate, which depends on how well the draft predicts the target. Predictable text — code, structured output, formulaic prose — accepts well and can cut [TPOT](#tpot) substantially. Unpredictable text accepts poorly, and then the draft work is pure overhead.

The important caveat is that it spends exactly the resource batching wants. Under high [concurrency](#concurrency) the arithmetic units are no longer idle, so there is no spare capacity to trade and speculation can reduce total [throughput](#throughput). It helps most at low concurrency, where latency matters and the [GPU](#gpu) is underused.

_Usage:_

"Speculative decoding made our batch job slower."

"It trades spare compute for latency, and at high batch sizes there isn't any spare. It's a low-concurrency optimization — turn it off for bulk work."

## Section 7 — Splitting Across GPUs

### Model parallelism

Splitting a single model's work across multiple [GPUs](#gpu). The umbrella term for several distinct strategies that differ in what gets cut and what it costs to stitch back together.

You reach for it for one of two reasons. Either the [model weights](#model-weights) do not fit on one card — a 70B model at BF16 needs 140 GB and no single GPU has that — or they fit but leave too little room for [KV cache](#kv-cache) to serve useful [concurrency](#concurrency). The second reason is the more common one in practice, and the one people arrive at after discovering their [VRAM budget](#vram-budget) was optimistic.

| Strategy                                | What is split                          | Communication per token       | Buys you                                                       |
| --------------------------------------- | -------------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| [Tensor](#tensor-parallelism)     | Each layer's matrices, across all GPUs | High — every layer, twice     | Capacity and lower latency                                     |
| [Pipeline](#pipeline-parallelism) | Layers into sequential stages          | Low — once per stage boundary | Capacity across loose interconnects                            |
| [Data](#data-parallelism)         | Nothing; whole copies                  | None between replicas         | Throughput, not capacity                                       |
| [Expert](#expert-parallelism)     | MoE experts across GPUs                | Moderate — routing per layer  | Capacity for [mixture of experts](#mixture-of-experts) |

The distinction that matters most is the first against the third. Tensor parallelism puts one model on several GPUs, so a single request uses all of them. Data parallelism puts several copies of the model on several GPUs, so each request uses one. The first raises the ceiling on model size and can lower [latency](#latency); the second raises [throughput](#throughput) and does nothing for a model that does not fit.

These compose. A common production shape is tensor parallelism within a machine, where [NVLink](#nvlink) is fast, and data parallelism across machines.

_Usage:_

"We've got eight GPUs and a model that fits on two. How do we split it?"

"Four data-parallel replicas of a two-way tensor-parallel model. Don't spread one model over all eight — you'd add communication overhead for capacity you don't need."

### Tensor parallelism

Splitting the matrices inside each layer across several [GPUs](#gpu), so every card holds a slice of every layer and all of them work on the same [token](#token) simultaneously. The most common form of [model parallelism](#model-parallelism) for inference.

Each GPU multiplies its slice of the weights against the input and produces a partial result; the partials are then combined and shared so every card has what the next layer needs. That combination happens through a collective operation over [NCCL](#nccl), typically twice per layer, so an 80-layer model synchronizes across GPUs more than a hundred times per token.

The gains are real and there are two of them. Capacity is the obvious one: four cards give four times the [VRAM](#vram), so a model that does not fit on one becomes servable, and the [VRAM budget](#vram-budget) gains room for [KV cache](#kv-cache). Less obvious is that [decode](#decode) also gets faster, because it is [memory bound](#memory-bound) — the weights are read in parallel across four cards' worth of [memory bandwidth](#memory-bandwidth), so time per token drops.

The cost is the chain worth internalising. More tensor parallelism means more GPUs participating in every single token, which means more synchronization per token, which means [communication overhead](#communication-overhead) grows with the degree of splitting. Past a point the cards spend more time waiting for each other than computing, and adding another GPU makes things slower. Where that point falls depends almost entirely on the interconnect: over [NVLink](#nvlink) within one machine, eight-way is routine; over PCIe, even four-way often disappoints; across machines without [RDMA](#rdma) it is usually a mistake.

Keep tensor parallelism inside a machine and use [data parallelism](#data-parallelism) to scale beyond it.

_Usage:_

"We went from two-way to four-way tensor parallel and throughput dropped."

"Are those four on the same NVLink domain? If two of them are talking over PCIe, the all-reduce every layer is costing more than the extra bandwidth is worth."

### Pipeline parallelism

Splitting a model's layers into consecutive stages and putting each stage on a different [GPU](#gpu). A request flows through stage one, is handed to stage two, and so on, with each card holding a contiguous block of layers rather than a slice of every layer.

Its advantage over [tensor parallelism](#tensor-parallelism) is how little it communicates. Data crosses between GPUs only at stage boundaries — three transfers for a four-stage split, rather than two per layer — and what crosses is a small activation tensor rather than a full synchronization. That makes pipeline parallelism viable where the interconnect is weak: across machines, over PCIe, anywhere [NVLink](#nvlink) is not available, which is exactly where tensor parallelism falls apart.

The weakness is idle time, usually called the pipeline bubble. Stage two cannot start on a request until stage one has finished with it, so with a single request in flight three of four GPUs are always waiting. Keeping the pipeline full requires enough concurrent requests to occupy every stage at once, which means pipeline parallelism raises [throughput](#throughput) at high [concurrency](#concurrency) and does nothing for the [latency](#latency) of an individual request. Tensor parallelism is the opposite: it lowers single-request latency because every card works on the same [token](#token).

That difference is what decides between them. Interactive serving at modest concurrency favours tensor parallelism inside a machine. Very large models that must span machines, or batch workloads with plenty of requests to keep every stage busy, favour pipeline parallelism — often with tensor parallelism used within each stage.

_Usage:_

"Pipeline parallel across four nodes and it's no faster per request."

"It won't be — one request is only ever on one stage. It buys capacity and throughput under load, not latency. You need enough in flight to fill the pipeline."

### Data parallelism

Running complete, independent copies of a model on separate [GPUs](#gpu) and distributing incoming requests among them. Each replica serves a request entirely on its own, and the replicas never talk to each other.

It is the simplest form of scaling and the one to reach for first. Because [model weights](#model-weights) are read-only during inference, replicas share nothing and need no coordination — no collective operations, no [NCCL](#nccl), no sensitivity to interconnect quality. Two replicas serve twice the [throughput](#throughput) of one, and the scaling stays close to linear as long as [load balancing](#load-balancing) spreads work evenly.

What it does not do is raise capacity. Every replica needs the full [VRAM budget](#vram-budget) to itself, so a model that does not fit on one card does not fit on four either — that requires [tensor parallelism](#tensor-parallelism) or [pipeline parallelism](#pipeline-parallelism). Data parallelism also leaves per-request [latency](#latency) unchanged, since a request is served by a single GPU exactly as it would have been alone.

Note that memory is paid per replica, and that includes the [KV cache](#kv-cache) pool. Four replicas each hold their own cache, so a prompt that would have been a [prefix caching](#prefix-caching) hit is only a hit if the request lands on the replica that has it — one of the few places where replica-aware [routing](#load-balancing) is worth the complexity.

In production it is usually combined rather than chosen: tensor parallelism inside each machine to make the model fit and to use the local interconnect, data parallelism across machines to scale out.

_Usage:_

"Can we run the 70B across four cards with data parallelism?"

"Data parallel means four full copies, and one copy doesn't fit. You need tensor parallelism for that — data parallelism only helps once the model already fits."

### Expert parallelism

Placing different experts of a [mixture of experts](#mixture-of-experts) model on different [GPUs](#gpu), so each card holds a subset of the experts rather than a slice of every one. Tokens are routed to whichever GPU holds the expert they need.

It exists because MoE models fit the other strategies badly. The whole architecture is built on only a fraction of the network running per [token](#token), and splitting every expert across every card with [tensor parallelism](#tensor-parallelism) throws that structure away — every GPU ends up participating in every token anyway, which is what MoE was designed to avoid. Assigning whole experts to whole GPUs preserves the sparsity: a token activates two experts, so it touches two cards.

The communication pattern is different from tensor parallelism's. Rather than synchronizing partial results twice per layer, tokens are dispatched to the GPUs holding their chosen experts and the outputs are gathered back — an all-to-all exchange, once per MoE layer. Volume is lower than tensor parallelism's all-reduces, but the pattern is less regular and more sensitive to [network topology](#communication-overhead).

The failure mode is unique to this strategy and worth knowing: load imbalance. Routing is learned, not uniform, so some experts are chosen far more often than others. A GPU holding two popular experts becomes the bottleneck for every step while cards holding unpopular ones idle, and the slowest card sets the pace. Models are trained with balancing losses to reduce this, and serving frameworks can replicate hot experts across several GPUs, but it remains the thing to check when an MoE deployment underperforms its arithmetic.

_Usage:_

"Expert parallel across eight cards and utilization is lopsided — two are pinned, the rest are half idle."

"Routing isn't uniform. Those two hold the popular experts. Replicate the hot ones across more GPUs, or rebalance the placement."

### NCCL

**NVIDIA Collective Communications Library.** The library that moves data between [GPUs](#gpu) in a distributed job. Every form of [model parallelism](#model-parallelism) issues its cross-GPU traffic through it, so NCCL's behaviour is the practical performance of a multi-GPU deployment.

It implements collective operations — patterns involving all participating processes rather than point-to-point sends. All-reduce, which combines a value across every GPU and gives every GPU the result, is the one [tensor parallelism](#tensor-parallelism) leans on: each layer's partial results are all-reduced so every card can proceed. All-gather and reduce-scatter appear in sharded setups, and all-to-all is what [expert parallelism](#expert-parallelism) uses to dispatch [tokens](#token).

Two pieces of vocabulary come with it. Rank is the identifier of one process in the group — rank 0 through 7 for eight GPUs — and world size is how many there are in total. Both appear throughout engine configuration and in nearly every distributed error message.

NCCL discovers the available paths and picks the fastest: [NVLink](#nvlink) between GPUs that have it, PCIe otherwise, [RDMA](#rdma) over InfiniBand or Ethernet between machines. This is also why it is a common source of trouble. A misconfigured container without the right network capabilities, a missing shared memory allocation, or an interface NCCL cannot see will either fail at startup or, worse, silently fall back to a slow path — a job that works but runs at a fraction of expected speed. Setting `NCCL_DEBUG=INFO` and reading which transport it selected is the standard first diagnostic.

_Usage:_

"Tensor parallel across two cards is barely faster than one, and they're both NVLinked."

"Check NCCL_DEBUG. If it picked PCIe instead of NVLink, the all-reduces are going the slow way and you'd never know from the logs otherwise."

### NVLink

A direct high-bandwidth connection between [GPUs](#gpu) inside a machine, bypassing PCIe and the CPU entirely. Whether a pair of cards has it is often the difference between multi-GPU serving that works and multi-GPU serving that disappoints.

The gap against PCIe is large enough to change which strategies are viable. PCIe Gen5 x16 provides roughly 64 GB/s per direction and is shared with everything else on the bus; NVLink provides hundreds of GB/s directly between cards. Since [tensor parallelism](#tensor-parallelism) synchronizes twice per layer — over a hundred times per [token](#token) on a large model — that difference compounds into most of the achievable [throughput](#throughput). Eight-way tensor parallelism is routine over NVLink and usually a bad idea over PCIe.

At larger scale NVSwitch extends the idea. Rather than direct links between specific pairs, a switching fabric connects every GPU in the machine at full bandwidth, so an eight-GPU node behaves as one uniformly connected group instead of a graph with fast and slow edges. This is what DGX-class systems provide and why they are priced as they are.

The practical consequence is a deployment rule. Keep tensor parallelism within an NVLink domain and use [data parallelism](#data-parallelism) or [pipeline parallelism](#pipeline-parallelism) to cross beyond it, since those communicate far less. It is also worth verifying rather than assuming: `nvidia-smi topo -m` prints the actual topology, and cloud instances with the same GPU model can differ in how those GPUs are connected — a real source of [communication overhead](#communication-overhead) that never appears in the instance name.

_Usage:_

"Same eight A100s as the other provider, half the throughput."

"Run nvidia-smi topo -m on both. If one is NVSwitch and the other is PCIe pairs, that's your answer — the GPUs are identical and the fabric isn't."

### RDMA

**Remote Direct Memory Access.** A networking capability that lets one machine write into another machine's memory directly, without the operating system or CPU on either side handling the data. With GPUDirect RDMA the network adapter reads and writes [GPU](#gpu) memory itself, so data never touches system RAM.

It matters because the ordinary network path is disastrous for this workload. Conventionally, sending a tensor between machines means copying it from GPU memory to system RAM, through the kernel's network stack, across the wire, and back up the same ladder on the far side. Each copy costs bandwidth and latency, and the CPU is involved throughout. RDMA removes all of it: the adapter moves bytes from one GPU to another with microsecond latency and no CPU involvement.

That is what makes multi-node work practical. [Tensor parallelism](#tensor-parallelism) spanning machines synchronizes constantly, and without RDMA the per-token cost of that synchronization exceeds any benefit — the standard advice to keep tensor parallelism inside one machine is really advice about interconnect quality. With InfiniBand or RoCE and RDMA available, spanning machines becomes a decision about [communication overhead](#communication-overhead) rather than an obvious mistake. [NCCL](#nccl) uses it automatically when it is present.

The operational catch is that availability is not automatic. RDMA needs the hardware, the drivers, and container privileges to expose the devices. A container missing them falls back to TCP silently, and the job runs — slowly, with no error explaining why. On a managed platform this is worth confirming rather than assuming, since it is invisible until you run a [benchmark](#benchmark).

_Usage:_

"Two-node tensor parallel is slower than one node alone."

"Is RDMA actually active in the container? Without it, NCCL is going over TCP through the kernel, and the per-layer all-reduce eats everything you gained."

### Communication overhead

The time GPUs in a distributed deployment spend moving data between themselves rather than computing. It is the tax on [model parallelism](#model-parallelism), and it is what makes adding another GPU sometimes slower rather than faster.

The interconnect a transfer travels over changes the cost by orders of magnitude, which is why identical GPU counts perform so differently across machines:

| Path                           | Scope                     | Rough bandwidth                   | Carries                                                     |
| ------------------------------ | ------------------------- | --------------------------------- | ----------------------------------------------------------- |
| NVSwitch                       | Within a node             | Hundreds of GB/s, uniform         | Any-to-any [tensor parallelism](#tensor-parallelism)  |
| [NVLink](#nvlink)          | Between paired GPUs       | Hundreds of GB/s                  | Tensor parallelism                                          |
| PCIe                           | Within a node, shared bus | ~64 GB/s                          | Fallback, [CPU offload](#cpu-offload)                 |
| InfiniBand + [RDMA](#rdma) | Between nodes             | 100–400 Gb/s, microsecond latency | [Pipeline](#pipeline-parallelism) and cross-node work |
| Ethernet, no RDMA              | Between nodes             | Through the kernel, high latency  | Barely viable for parallelism                               |

Two properties decide how much a strategy suffers: how often it communicates and how much it sends. Tensor parallelism synchronizes twice per layer — over a hundred times per [token](#token) — so it is acutely sensitive and belongs inside a fast domain. Pipeline parallelism transfers once per stage boundary and tolerates weak links. [Data parallelism](#data-parallelism) communicates nothing between replicas at all, which is why it scales furthest.

Hence the chain worth remembering: more tensor parallelism means more GPUs per request, which means more synchronization per token, which means more overhead. You are buying capacity and paying in coordination, and past some degree the payment exceeds the purchase. Where that point sits is a property of the fabric, not of the model, so it has to be measured on the actual hardware.

_Usage:_

"Why not just split it across all sixteen GPUs?"

"Because every layer would synchronize sixteen ways, twice, per token. Past the NVLink domain you're paying more in communication than you gain in bandwidth."

## Section 8 — Serving Real Traffic

### Endpoint

The network-addressable interface a client sends inference requests to. It is the stable public face of a deployment: a URL and a contract, usually an [OpenAI-compatible API](#openai-compatible-api), that stays constant while everything behind it changes.

The separation is the point. Behind one endpoint sit some number of [workers](#worker), each running an [inference engine](#inference-engine) with the model loaded. That number changes as [autoscaling](#autoscaling) responds to demand, individual workers fail and are replaced, and deployments roll out new versions. None of that is visible to the caller, which is what makes capacity a runtime concern rather than a client concern.

An endpoint also owns the behaviour that does not belong to any single worker. [Load balancing](#load-balancing) decides which worker gets a request. The queue holds requests when every worker is busy, and its [depth](#queue-depth) is the earliest signal that capacity is short. [Timeouts](#timeout), retries and [backpressure](#backpressure) policy live here too, along with authentication and per-client limits.

One endpoint generally means one model. Serving several models means several endpoints, each with its own workers holding its own [model weights](#model-weights) in [VRAM](#vram) — models are not cheap to swap, so an endpoint that had to load a different model per request would spend its life paying [model load time](#model-load-time).

_Usage:_

"Do we need a separate endpoint for the summarizer?"

"If it's a different model, yes — one endpoint's workers hold one model in VRAM. Same model with a different system prompt is just a different request."

### Worker

A single compute instance running an [inference engine](#inference-engine) with the [model weights](#model-weights) loaded, serving requests behind an [endpoint](#endpoint). It is the unit that gets provisioned, scaled, billed, and killed.

A worker owns one or more [GPUs](#gpu) and everything in their [VRAM](#vram): the weights, the [KV cache](#kv-cache) pool, and the runtime. That gives each worker its own independent [KV cache capacity](#kv-cache-capacity) and therefore its own [concurrency](#concurrency) ceiling. Total capacity for an endpoint is roughly the per-worker ceiling times the number of workers, which is [data parallelism](#data-parallelism) described from the operations side. A worker running a model split by [tensor parallelism](#tensor-parallelism) holds several GPUs but is still one worker, because a request uses all of them together.

The platform decides whether a worker is usable through a [health check](#health-check), and getting that wrong is a common way to break an otherwise correct deployment — a worker still loading weights is alive but not ready, and a probe that cannot tell the difference will kill it and start again.

Workers are stateless between requests, which is what makes the whole model of scaling work — any worker can serve any request, so [load balancing](#load-balancing) needs no affinity and a failed worker loses only its in-flight work. The exception worth knowing is cached state: a [prefix caching](#prefix-caching) hit only happens on the worker that has the prefix, so adding workers dilutes hit rates unless routing accounts for it.

The expensive part of a worker's life is its beginning. Starting one means pulling a [container image](#container-image), loading tens of gigabytes of weights, and often compiling or capturing graphs — the [cold start](#cold-start). That cost is what makes [scale to zero](#scale-to-zero) a real trade rather than an obvious win, and why keeping a worker warm is usually worth its [idle cost](#idle-cost).

_Usage:_

"We've got four workers, so we can handle four requests at once?"

"Each worker handles many at once — its limit is KV cache capacity, not one. Four workers is four times whatever a single one supports."

### Queue depth

The number of requests waiting for capacity rather than being processed. A queue sits behind every [endpoint](#endpoint), holding work when the [workers](#worker) cannot accept more, and its depth is the most direct measurement of whether capacity matches demand.

It is the best early-warning signal available, because it moves before anything else does. A queue that is empty means spare capacity. A queue that is short and stable means demand and capacity are matched. A queue that is growing means arrivals exceed completions, and the important property of that state is that it does not stabilize on its own — every second of it adds waiting time to every subsequent request. [Latency](#latency) climbs, but it climbs after the queue has already told you.

Depth translates into wait time by way of completion rate: a queue of 40 in front of a service completing 10 requests per second means a 4-second wait before a request even starts, added to its [TTFT](#ttft). This is why a deployment can show healthy per-request timings and terrible user-visible latency at the same time, and why queue depth belongs on a dashboard next to [GPU utilization](#gpu-utilization) rather than behind it.

Some queueing is deliberate and good. It absorbs bursts and keeps workers fed, which is why [autoscaling](#autoscaling) usually reacts to queue depth rather than to utilization. Persistent growth is not absorbable and needs either more workers or [backpressure](#backpressure) to shed load. A queue with no bound is the worst arrangement: it accepts everything, delivers everything late, and the requests it eventually serves have often already been abandoned — the distinction [goodput](#goodput) draws.

_Usage:_

"Latency is up but the GPUs aren't maxed out."

"Look at queue depth. If it's growing, requests are waiting on KV cache room, not on compute — utilization won't show you that."

### Concurrency

The number of requests being processed at the same time. It is the dial that connects almost everything else: memory use, [throughput](#throughput), [latency](#latency), and ultimately cost per request.

Raising concurrency raises throughput, up to a point. Because [decode](#decode) is [memory bound](#memory-bound), adding requests to an in-flight batch costs almost no extra time — the [model weights](#model-weights) are read once and used for everyone — so the same hardware produces far more total [tokens](#token) per second. This is why a deployment serving one user at a time is wasting most of the [GPU](#gpu) it is paying for.

What limits it is memory rather than compute. Every concurrent request holds its own [KV cache](#kv-cache) for as long as it is alive, so the ceiling is [KV cache capacity](#kv-cache-capacity): the [VRAM](#vram) left after the weights load, divided by what each request needs. Longer [context windows](#context-window) make each request more expensive and push that ceiling down. Configure a limit above what memory can actually hold and requests don't run in parallel — they wait, which shows up as growing [queue depth](#queue-depth) and rising [TTFT](#ttft) rather than as an error.

Past a certain level, more concurrency stops buying throughput and only adds latency. That point is [saturation](#saturation), and finding where it sits on your own traffic is what a [concurrency sweep](#concurrency-sweep) is for.

_Avoid:_ using it interchangeably with [batch size](#batch-size). Concurrency is how many requests are in the system; batch size is how many the engine runs in a single step, and under [continuous batching](#continuous-batching) those are not the same number.

_Usage:_

"We set max concurrency to 256 to be safe."

"That's well above what your KV cache holds at these context lengths. They won't run in parallel, they'll sit in the queue and inflate your TTFT."

### Load balancing

Distributing incoming requests across the available [workers](#worker) behind an [endpoint](#endpoint). Simple in principle, and the naive strategy is a genuinely poor fit for inference.

Round-robin and random assignment assume requests cost roughly the same. Inference requests do not: one is 200 [tokens](#token) in and 50 out, the next is 30,000 in and 2,000 out, and the second occupies a worker's [KV cache](#kv-cache) and compute for orders of magnitude longer. Spreading requests evenly by count therefore spreads load very unevenly, and some workers sit at their [KV cache capacity](#kv-cache-capacity) while others idle.

Better strategies route on state rather than on turn. Least-outstanding-requests sends work to whichever worker has the fewest in flight, which tracks actual occupancy. Engines that report their own queue and cache pressure allow routing on that directly, which is better still — a readiness [health check](#health-check) that reports real admission capacity, rather than merely that the process is up, is what makes this possible. The general principle is that the load balancer should ask how busy a worker is rather than how many requests it has been sent.

Two inference-specific considerations complicate it further. [Prefix caching](#prefix-caching) is per worker, so routing requests that share a prefix to the same worker turns a miss into a hit — a real gain that pure load-based routing throws away, and the reason prefix-aware routing exists. And [streaming](#streaming) means connections are long-lived, so a balancer that assumes short requests will hold connections open in ways it did not expect.

Where load balancing cannot help is when every worker is genuinely full. At that point the answer is [autoscaling](#autoscaling) or [backpressure](#backpressure), not smarter distribution.

_Usage:_

"One worker keeps OOMing while the others look fine."

"Round-robin is sending it long requests by chance. Switch to least-outstanding — count-based balancing doesn't reflect what a request actually costs."

### Backpressure

Refusing or deferring incoming work when a service is at capacity, rather than accepting it and serving it late. The mechanism is usually a bounded queue: past a set [depth](#queue-depth), new requests are rejected with a 429 and a retry hint instead of being admitted.

The instinct to accept everything is the one worth arguing against. An unbounded queue does not add capacity, it converts a capacity shortage into a latency problem and hides it. Requests pile up, each one waits longer than the last, and the service eventually returns answers to clients that gave up seconds ago — work that consumed [KV cache](#kv-cache), [GPU](#gpu) time and money while producing nothing, which is exactly the gap [goodput](#goodput) measures.

It gets worse than merely wasteful. Clients that time out generally [retry](#timeout), so the load that overwhelmed the service returns amplified, at the moment it is least able to absorb it. Backpressure breaks that loop by making the failure immediate and visible: a fast 429 lets a caller back off, queue the work itself, or degrade gracefully, and none of those are possible while it is still waiting hopefully.

Setting the threshold is a matter of arithmetic rather than taste. Given a completion rate and a latency target, the maximum useful queue depth is the number of requests that can still be served in time — anything beyond it is a request you have chosen to serve too late. Pair it with [autoscaling](#autoscaling) so that sustained rejection triggers more [workers](#worker), and treat the rejection rate as the signal that capacity is short.

_Usage:_

"Should we just let the queue grow during spikes instead of returning errors?"

"Then everyone waits and half of them have already left. Bound it — a fast 429 lets the caller retry sensibly instead of you burning GPU on abandoned work."

### Health check

A probe that asks a [worker](#worker) whether it is functioning, so the platform can decide whether to send it traffic or replace it. Inference deployments need to distinguish several questions that look similar and are not.

| Check     | Question                             | On failure                                                         |
| --------- | ------------------------------------ | ------------------------------------------------------------------ |
| Startup   | Has it finished loading yet?         | Keep waiting, don't kill it                                        |
| Readiness | Can it take traffic right now?       | Remove from [load balancing](#load-balancing), leave running |
| Liveness  | Is the process still working at all? | Kill and replace it                                                |

Collapsing these is the classic inference deployment failure, and it happens because [model load time](#model-load-time) is long. A worker pulling a [container image](#container-image) and loading 140 GB of [model weights](#model-weights) can take minutes during which it answers nothing. A liveness probe with a short timeout concludes it is broken and kills it, the replacement starts loading from scratch, and the deployment never comes up. A generous startup probe, or a long initial delay, is the fix.

The other half is readiness. A worker at its [KV cache capacity](#kv-cache-capacity) is healthy but should not receive more work; one that is loading is alive but not ready. Readiness that reports actual admission capacity rather than merely "process running" is what lets a balancer route around pressure instead of piling onto it.

Make the check meaningful. A handler that returns 200 unconditionally proves the HTTP server is up and nothing about whether the model is loaded or the [GPU](#gpu) is present — a worker whose CUDA context has died will pass it happily and fail every real request.

_Usage:_

"New workers keep getting killed and restarted before they ever serve anything."

"Liveness probe is firing during model load. Add a startup probe with a timeout longer than your worst cold start, and don't let liveness run until it passes."

### Timeout

The maximum time an operation is allowed before it is abandoned. Straightforward for most services and awkward for inference, because request duration varies by orders of magnitude for reasons no one can see in advance.

The difficulty is that response time is dominated by output length, and output length is not known until generation ends. A request that produces 50 [tokens](#token) finishes in under a second; the same prompt producing 2,000 takes a minute. A single timeout has to accommodate the longest legitimate response, which makes it useless as a signal that anything is wrong — by the time it fires, a minute of [GPU](#gpu) time has already been spent.

[Streaming](#streaming) offers a better instrument. With tokens arriving continuously, the useful deadline is not total duration but silence: a gap of several seconds between tokens genuinely indicates a stall, while a long-but-flowing response is fine. An idle timeout between tokens plus a generous overall ceiling detects real failures without penalising long answers. Capping maximum output tokens per request bounds the worst case directly, which is often the more effective control.

Retries are the other half and the more dangerous one. A timeout followed by an immediate retry doubles load exactly when a service is already struggling, and if many clients do it simultaneously the result is a retry storm that turns slowness into an outage. Retries need exponential backoff, jitter, and a cap. They should also be skipped entirely for a request already known to be expensive — retrying a 30,000-token prompt against a [saturated](#saturation) service adds a large amount of work with a low chance of success. Cancelling on client disconnect matters for the same reason: an abandoned request still holds [KV cache](#kv-cache) and a slot until it is stopped.

_Usage:_

"We set a 30-second timeout and now long generations fail."

"Use an inter-token idle timeout instead — a few seconds of silence is a real stall, but a two-minute answer streaming steadily is working fine."

### Saturation

The point at which additional load stops producing additional useful work. Below it, more [concurrency](#concurrency) means more [throughput](#throughput); above it, throughput is flat or falling while [latency](#latency) climbs steeply.

The behaviour past that point is worth expecting, because it is not gradual. A service at 80% of capacity looks healthy and a service at 105% degrades fast, since the excess accumulates: arrivals exceed completions, [queue depth](#queue-depth) grows without bound, waiting time grows with it, clients begin to [time out](#timeout) and retry, and the retries add load. The knee in the curve is sharp, which is why capacity headroom is worth paying for rather than optimizing away.

In inference, saturation has a specific and unusual first cause. On most services the limit is compute; here it is usually memory. Once in-flight requests exhaust [KV cache capacity](#kv-cache-capacity), the engine cannot admit more regardless of idle arithmetic capacity, so new requests queue and existing ones may face [eviction](#kv-cache-eviction). This is why a [saturated](#gpu-utilization) inference deployment often shows unremarkable GPU utilization — the constraint was never compute.

Finding the point requires measurement, since it depends on the model, the hardware and the [workload shape](#workload-shape) together. A [concurrency sweep](#concurrency-sweep) plots throughput and latency against load, and the knee is visible directly. Configure limits below it, use [backpressure](#backpressure) to hold the line, and let [autoscaling](#autoscaling) add [workers](#worker) rather than letting one absorb more than it can.

_Usage:_

"It was completely fine yesterday and today it's falling over. Traffic is only up 15%."

"You were just under the knee and now you're over it. Past saturation the queue grows without bound — the last 15% isn't costing 15%."

### Autoscaling

Adjusting the number of [workers](#worker) behind an [endpoint](#endpoint) automatically in response to demand. Scaling out adds workers, scaling in removes them; the intent is to pay for capacity roughly in proportion to use.

GPU inference makes this harder than ordinary web autoscaling in one specific way: the response is slow. A stateless web container starts in seconds, so reactive scaling works. A worker must be provisioned, pull a [container image](#container-image), and load tens of gigabytes of [model weights](#model-weights) — a [cold start](#cold-start) measured in minutes. By the time capacity arrives the spike may be over, and everything in between was served badly or not at all. GPU availability adds a second constraint that no amount of configuration fixes: the instance type you want may not exist right now.

Which signal to scale on matters. [GPU utilization](#gpu-utilization) is the intuitive choice and a poor one, since a [memory bound](#memory-bound) [decode](#decode) step reads as busy while the card is underused. [Queue depth](#queue-depth), or requests waiting per worker, tracks the thing that actually hurts and moves earlier.

Scaling in deserves as much thought as scaling out. Removing a worker mid-request drops in-flight work, so workers need to drain — stop accepting new requests, finish current ones, then exit — and [streaming](#streaming) responses can hold connections open for minutes. Scale in on a longer delay than you scale out, because the cost of a premature removal is a cold start you then have to pay again.

The floor is the real decision. [Scale to zero](#scale-to-zero) eliminates [idle cost](#idle-cost) and guarantees a cold start on the next request; a minimum of one keeps latency predictable and pays around the clock.

_Usage:_

"Autoscaling is on but every traffic spike still times out."

"Scaling on utilization, and a worker takes four minutes to load. Scale on queue depth and keep a warm one — reactive scaling can't outrun a cold start."

## Section 9 — Getting the Model Onto the Machine

### Container image

The packaged filesystem and configuration a [worker](#worker) is created from — the [inference engine](#inference-engine), its Python environment, CUDA libraries, and the entrypoint that starts serving. Built from a Dockerfile, stored in a registry, and pulled onto a machine before the worker can start.

The decision that matters is what goes inside. Baking [model weights](#model-weights) into the image is tempting because it makes the worker self-contained, and it is usually wrong: a 140 GB model produces a 140 GB image that has to be pulled over the network every time a worker starts on a machine that does not already have it. That pull is often the largest single component of a [cold start](#cold-start). Keeping weights out and reading them from a [model cache](#model-cache) or a [network volume](#network-volume) leaves an image of a few gigabytes that pulls quickly and is cached on the host after the first time.

Image layers reward ordering. Layers are cached individually and invalidated from the first change downward, so putting rarely-changed things first — base image, CUDA, dependencies — and frequently-changed things last means a code change re-pulls a small layer rather than the whole image. GPU images are large enough that this is worth doing deliberately.

Configuration comes in at runtime rather than build time. Environment variables carry model paths, [tensor parallelism](#tensor-parallelism) degree, and cache sizing; secrets such as API keys are injected by the platform rather than built in, since anything in a layer is readable by anyone who can pull the image.

_Usage:_

"Cold starts are eight minutes and most of it is before the model even starts loading."

"Your image has the weights in it. Pull them from a network volume instead — the image drops to two gigs and most of that eight minutes disappears."

### Model cache

Model files kept somewhere a starting [worker](#worker) can read them quickly, rather than downloaded from a public hub each time. Depending on the platform this is local NVMe on the host, a [network volume](#network-volume), or a provider-managed cache close to the GPUs.

The saving is large because the alternative is so slow. Pulling 140 GB of [model weights](#model-weights) from a public registry takes minutes at best and is subject to rate limits and outages you do not control. Reading the same files from local NVMe is bounded by storage bandwidth — gigabytes per second — and reading them from a well-placed network volume sits between the two. On most deployments this is the single largest lever on [cold start](#cold-start).

The tiers differ in a way worth being explicit about. Local disk is fastest and is lost when the instance goes away, so the first worker on a fresh machine pays full price and later ones on that machine do not. A network volume survives instances but is shared, so its throughput is divided among everyone reading at once — twenty workers starting simultaneously will not each see full bandwidth, which is exactly the moment [autoscaling](#autoscaling) creates.

Two operational notes. Cache by content or by an immutable revision rather than by a mutable tag, so a model update produces a new entry instead of a stale hit. And remember the cache only removes the download; [model load time](#model-load-time) — reading the weights into [VRAM](#vram) and any engine compilation — still has to happen, and on a well-cached deployment it becomes the dominant remaining cost.

_Usage:_

"We put the weights on a network volume and cold starts are still two minutes."

"That removed the download. What's left is loading 140 gigs into VRAM plus graph capture — the cache can't help with that part."

### Network volume

Persistent storage attached over the network rather than physically to one machine, so its contents survive the [workers](#worker) that use it and can be mounted by several at once. Runpod's Network Volume is one instance of a general pattern.

The distinction that governs its use is persistence. Storage local to an instance is ephemeral: fast, but gone the moment the instance is destroyed, which for autoscaled GPU workloads is constantly. A network volume persists independently, which makes it the natural home for [model weights](#model-weights) — download once, mount everywhere, and every subsequent [cold start](#cold-start) skips the download entirely. It is also where a [model cache](#model-cache) shared across workers usually lives.

The trade is bandwidth, and it bites at the worst moment. A network volume's throughput is shared among everything reading it, so the numbers that look fine for one worker do not hold when [autoscaling](#autoscaling) starts twenty at once and each tries to read 140 GB. Effective per-worker bandwidth collapses and cold starts stretch well past what a single-worker test suggested. Local NVMe, where available, is faster but has to be populated per machine.

Two constraints follow from it being a network resource. It generally lives in one region or data center, so [workers](#worker) scheduled elsewhere cannot mount it — which quietly restricts where capacity can come from when your preferred GPUs are scarce. And it is billed for what is allocated, continuously, whether or not anything is running, so an oversized volume is a form of [idle cost](#idle-cost).

_Usage:_

"One worker starts in 90 seconds, but when we scale to ten it's five minutes each."

"They're all reading the same volume at once and splitting its bandwidth. Either stagger the scale-out or get the weights onto local disk."

### Model load time

The time between a [worker](#worker) having the [model weights](#model-weights) available and being able to serve a request. It covers reading the files from storage, moving them into [VRAM](#vram), and whatever initialization the [inference engine](#inference-engine) performs before it will accept work.

It is worth separating from the download it is often confused with. A [model cache](#model-cache) or [network volume](#network-volume) removes the transfer over the internet; model load time is what remains, and on a well-cached deployment it becomes the dominant part of the [cold start](#cold-start). Understanding which of the two you are paying determines whether faster storage helps at all.

Three things make it up. Reading the weights is bounded by storage throughput — 140 GB from NVMe at several GB/s is tens of seconds, from a shared volume considerably longer. Transferring into VRAM is bounded by PCIe. Then the engine initializes: allocating the [KV cache](#kv-cache) pool, warming kernels, and often capturing CUDA graphs or compiling, which for something like TensorRT-LLM can dominate everything else. Engines that do more work here start slower and then serve faster, which is a good trade for long-lived workers and a bad one for [scale to zero](#scale-to-zero).

The levers are the obvious ones plus one that is often overlooked: a smaller model loads faster. [Quantization](#quantization) to FP8 halves the bytes to read and transfer, so it cuts load time roughly in half as a side effect of the memory saving it was chosen for.

_Usage:_

"Weights are on local NVMe now and it still takes 90 seconds before it serves."

"That's engine init, not the read. Graph capture and cache allocation happen after the load — check whether you need it before profiling storage further."

### Cold start

The delay between deciding a new [worker](#worker) is needed and that worker being able to serve a request. For ordinary web services it is seconds; for GPU inference it is routinely minutes, and that difference shapes most scaling decisions.

It decomposes, and knowing which part dominates is what makes it addressable:

| Stage           | Typical  | How to cut it                                                                                       |
| --------------- | -------- | --------------------------------------------------------------------------------------------------- |
| Provisioning    | 10–60s   | Keep a worker warm; more flexible GPU choice                                                        |
| Image pull      | 10s–5min | Keep [model weights](#model-weights) out of the [container image](#container-image)     |
| Weight download | 0–10min  | [Model cache](#model-cache) or [network volume](#network-volume)                        |
| Load into VRAM  | 20s–2min | [Quantization](#quantization); faster storage — see [model load time](#model-load-time) |
| Engine init     | 5s–3min  | Skip graph capture or compilation if startup matters more                                           |
| First request   | seconds  | Warm it before marking ready                                                                        |

Two consequences follow. [Autoscaling](#autoscaling) cannot be purely reactive, because capacity requested when the queue grows arrives after the spike — scaling has to be early, or a warm worker has to absorb the gap. And cold starts land squarely in [tail latency](#tail-latency): a deployment with a good median and a p99 measured in seconds is usually looking at the requests that arrived while a worker was booting.

The underlying decision is [idle cost](#idle-cost) against startup latency. Paying for a worker that mostly sits idle removes cold starts from the user's experience; [scale to zero](#scale-to-zero) removes the cost and guarantees the first user after a quiet period waits. Platforms mitigate rather than eliminate this — Runpod's [FlashBoot](#flashboot) is one such mechanism.

_Usage:_

"p50 is 400ms and p99 is 45 seconds."

"Those are cold starts, not slow inference. Either keep one worker always on, or work through the stages — the image pull is usually the easiest win."

### Scale to zero

Allowing an [endpoint](#endpoint) to drop to no running [workers](#worker) when there is no demand, and starting one when a request arrives. The defining property of serverless GPU infrastructure, and a genuine trade rather than a free optimization.

What it buys is straightforward: [idle cost](#idle-cost) goes to zero. GPUs are expensive by the hour, and a workload that runs for two hours a day spends the other twenty-two paying for hardware doing nothing. For intermittent traffic — internal tools, batch jobs, development environments, early products with sparse usage — this is often the difference between viable and not.

What it costs is that somebody experiences the full [cold start](#cold-start), which for GPU inference is minutes rather than milliseconds. Worse, it is not evenly distributed: it lands on whoever arrives first after a quiet period, which is disproportionately the person trying the product for the first time. It also lands unpredictably, showing up as a bad [tail latency](#tail-latency) rather than as a uniformly slower service.

Whether the trade works depends on traffic shape, and the question to ask is what fraction of requests arrive cold. Steady traffic keeps a worker alive and almost never pays; sparse, bursty traffic pays constantly. The middle ground is a minimum of one worker — an [active worker](#active-worker) in Runpod's terms — which caps idle cost at a single GPU while ensuring someone is always ready. Providers also blunt the edge with mechanisms like [FlashBoot](#flashboot) that retain reusable state so a restart is not a full boot.

The idle timeout before scaling down is the tuning dial: too short and you pay cold starts during ordinary gaps in traffic; too long and you are paying for idle capacity you meant to avoid.

_Usage:_

"Scale to zero saved us a fortune but users say it's unreliable."

"They're hitting cold starts after quiet periods. Keep one active worker — you'll pay for one GPU instead of zero, and nobody waits four minutes."

## Section 10 — Benchmarking & What It Costs

### Benchmark

A controlled test measuring how a deployment performs. The word covers several distinct exercises — a load test at expected traffic, a stress test pushed until things break, a comparison between two configurations — and they answer different questions.

The reason to run your own rather than trust a published figure is that inference performance depends on the [workload shape](#workload-shape) as much as on the hardware. A benchmark using 128-token prompts and 128-token outputs measures mostly [decode](#decode) and rewards [memory bandwidth](#memory-bandwidth). One using 8,000-token prompts and 200-token outputs measures mostly [prefill](#prefill) and rewards arithmetic. Two GPUs can trade places between those, so a number produced under someone else's traffic shape does not transfer to yours.

Getting a benchmark right is mostly about avoiding a few specific errors. Warm up first — the first requests pay [cold start](#cold-start), engine initialization and cache population, and including them measures startup rather than steady state. Measure at realistic [concurrency](#concurrency), since single-request numbers tell you almost nothing about a batching system. Report percentiles rather than averages, because the [tail](#tail-latency) is where the problems are. And use realistic prompts: if production shares a system prompt, the benchmark should too, or [prefix caching](#prefix-caching) will make the test look worse than reality — and if it does not share one, a benchmark that repeats the same prompt will look far better.

The most useful single output is not a number but a curve, from a [concurrency sweep](#concurrency-sweep), showing where [throughput](#throughput) flattens and [latency](#latency) turns up. That is what tells you where to set limits.

_Usage:_

"The vendor benchmark says 3,000 tokens a second and we're seeing 600."

"What prompt lengths did they use? If they measured short prompts and yours are 8k, you're paying for prefill they never measured."

### Workload shape

The characteristic profile of a deployment's traffic: how long the prompts are, how long the outputs are, how many requests arrive at once, and how much the prompts share. It is the missing context that makes most performance numbers uninterpretable.

The reason it matters so much is that the two stages of inference have opposite bottlenecks. Input [tokens](#token) are processed in [prefill](#prefill), which is [compute bound](#compute-bound); output tokens are produced in [decode](#decode), which is [memory bound](#memory-bound). The ratio between them decides which limit you are against, and therefore which GPU is right, which engine settings matter, and where [saturation](#saturation) sits:

| Shape               | Example                            | Dominated by                                 | Favours                                                    |
| ------------------- | ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| Long in, short out  | Summarization, classification, RAG | Prefill                                      | Arithmetic; [prefix caching](#prefix-caching)        |
| Short in, long out  | Story or code generation           | Decode                                       | [Memory bandwidth](#memory-bandwidth); large batches |
| Long in, long out   | Agents, document rewriting         | Both, plus heavy [KV cache](#kv-cache) | Memory capacity                                            |
| Short in, short out | Extraction, routing                | Overhead and scheduling                      | High [concurrency](#concurrency)                       |

Shape also sets the memory arithmetic. Sequence length times concurrency is what [KV cache capacity](#kv-cache-capacity) has to accommodate, so a shift toward longer contexts lowers the concurrency ceiling with no change in traffic volume.

Measure it rather than estimating it. Token count distributions from production logs — including the tail, since the longest requests drive worst-case memory — are what a [benchmark](#benchmark) should replay. A guessed shape produces a confidently wrong capacity plan.

_Usage:_

"Which GPU should we standardize on?"

"Depends on the shape. Mostly 10k-token RAG prompts with short answers is prefill-heavy, so pay for compute. Short prompts and long generations is the opposite."

### Concurrency sweep

A [benchmark](#benchmark) that repeats the same workload at increasing levels of [concurrency](#concurrency) — 1, 2, 4, 8, 16, 32 and upward — recording [throughput](#throughput) and latency percentiles at each. It produces the curve that a single measurement cannot.

The curve has a consistent shape, and each part of it answers a question. At low concurrency, throughput climbs nearly linearly while [TPOT](#tpot) barely moves: batching is amortizing the [model weights](#model-weights) read across more requests at almost no cost. Then throughput begins to flatten as either [KV cache capacity](#kv-cache-capacity) or arithmetic runs out. Past that, throughput is flat or falling while [TTFT](#ttft) and [tail latency](#tail-latency) climb steeply — [saturation](#saturation), where added load produces only waiting.

Three numbers come out of it, and they are the ones deployment configuration needs. The knee in the throughput curve is the highest useful concurrency. The point where latency percentiles cross your targets is where [goodput](#goodput) peaks, and it usually sits below the knee — that is the limit worth configuring. And the throughput at that level, divided by what the hardware costs, is your real [cost per million tokens](#cost-per-million-tokens).

A few details decide whether the result is usable. Hold the [workload shape](#workload-shape) fixed across levels, or you are varying two things at once. Warm up before each level. Run long enough at each that queues reach steady state, since a short run at high concurrency measures the transient rather than the equilibrium. And watch the engine's own [eviction](#kv-cache-eviction) counter — preemption starting is often the clearest marker of where the ceiling actually is.

_Usage:_

"What should we set max concurrency to?"

"Sweep it. Find where throughput stops improving, then back off to where p99 TTFT still meets your target — that's the number, and it's usually lower than you'd guess."

### GPU hour

The cost of one [GPU](#gpu) running for one hour. It is the headline figure on every provider's pricing page, and by itself it tells you almost nothing about what inference will cost.

The reason is that it prices time, not work. What you are actually buying is [tokens](#token), and how many tokens an hour of a given GPU produces varies by several times depending on the card, the model, the [inference engine](#inference-engine), the [quantization](#quantization), and the [workload shape](#workload-shape). Dividing the hourly rate by measured [throughput](#throughput) gives [cost per million tokens](#cost-per-million-tokens), which is the number that survives comparison — and it regularly ranks providers differently from the hourly rate, which is the point of computing it.

Billing granularity matters separately from the rate. Dedicated instances bill by the hour or minute for as long as they exist, whether or not they are serving anything, so anything below constant use pays [idle cost](#idle-cost). Serverless platforms bill by the second of actual execution, which changes the arithmetic for intermittent traffic — a workload running two hours a day can cost roughly a twelfth of an always-on instance, at the price of a [cold start](#cold-start) when it wakes.

Comparing options on that basis rather than on the sticker rate is what [price performance](#price-performance) means in practice. Cheaper hourly rates also often carry conditions worth pricing in: interruptible or spot capacity that can be reclaimed, older interconnects that make [tensor parallelism](#tensor-parallelism) slower, or regions far from your users. None of those show up in the hourly figure.

_Usage:_

"This provider is $1.80 an hour and ours is $2.40. Why aren't we moving?"

"Measure tokens per second on both first. If ours does twice the throughput, it's cheaper per million tokens despite the higher hourly rate."

### Idle cost

What you pay for compute that is provisioned but not doing useful work. On GPU infrastructure it is frequently the largest avoidable item in the bill, because the hardware is expensive and most traffic is uneven.

The arithmetic is unforgiving. A [GPU hour](#gpu-hour) is billed whether the card is [saturated](#saturation) or idle, so an endpoint serving a busy eight-hour weekday pays for 168 hours a week and uses 40. Traffic that follows office hours, or that is internal, or that is early-stage and sparse, can easily spend most of its budget on hardware waiting for requests. The [utilization](#gpu-utilization) figure people watch does not capture this — it describes the card while a [worker](#worker) exists, not the hours the worker existed with nothing to do.

Reducing it means matching capacity to demand more closely. [Autoscaling](#autoscaling) removes workers when traffic falls; [scale to zero](#scale-to-zero) removes the last one and takes idle cost to nothing. Both trade against [cold start](#cold-start), which is the real decision: whether the money saved is worth the users who wait. A minimum of one warm worker is the usual compromise, capping idle cost at a single GPU while keeping [latency](#latency) predictable — that one GPU is buying tail latency, and it is worth naming it that way rather than treating it as waste.

Note that idle cost hides in more than compute. A [network volume](#network-volume) is billed for allocated capacity continuously, whether or not anything is reading it, so oversized storage is idle cost that no autoscaling policy will ever reclaim.

_Usage:_

"The bill is four times what the traffic suggests it should be."

"Check how many hours those workers existed against how many they served. If it's an internal tool, you're paying overnight and at weekends for nothing."

### Cost per million tokens

Infrastructure spend divided by [tokens](#token) produced, scaled to a million. It is the unit that makes different hardware, providers and configurations comparable, because it prices work rather than time.

The calculation is hourly cost divided by measured [throughput](#throughput), converted to a per-million rate. What makes it worth doing is how often it reverses the ranking that [GPU hour](#gpu-hour) prices suggest:

|                      | GPU A     | GPU B     |
| -------------------- | --------- | --------- |
| Hourly rate          | $1.00     | $2.00     |
| Tokens per second    | 1,000     | 4,000     |
| Tokens per hour      | 3.6M      | 14.4M     |
| **Cost per million** | **$0.28** | **$0.14** |

GPU B costs twice as much per hour and half as much per token. Choosing on the hourly rate doubles the bill while feeling like a saving — which is the single most common costing mistake in this field.

Three things need care when computing it. Input and output tokens cost very different amounts to produce, since [prefill](#prefill) processes the prompt in parallel while [decode](#decode) emits one token at a time, so a blended rate only transfers between deployments with the same [workload shape](#workload-shape). The throughput figure must come from a realistic [concurrency](#concurrency) level, because single-request numbers understate a batching system by a wide margin. And [idle cost](#idle-cost) belongs in the numerator: a card that bills 24 hours and serves 6 has four times the effective cost per token that a utilization-blind calculation shows.

Every efficiency lever elsewhere in this dictionary ultimately lands here. [Quantization](#quantization), [prefix caching](#prefix-caching), [continuous batching](#continuous-batching) and right-sized [concurrency](#concurrency) all raise tokens per hour against a fixed rate, which is the same thing as lowering this number.

_Usage:_

"Finance wants to know if self-hosting beats the API."

"Compute cost per million tokens at your real concurrency, including the hours the GPUs sit idle. Against list API prices it's usually close, and the idle hours decide it."

### Price performance

The relationship between what infrastructure costs and what it delivers. In practice it means comparing options on [cost per million tokens](#cost-per-million-tokens) rather than on [GPU hour](#gpu-hour) rates, and it is the discipline that keeps hardware decisions honest.

The reason a cheaper card is so often the more expensive choice comes down to how inference actually consumes hardware. A newer GPU may cost twice as much per hour while delivering four times the throughput, because it has more [memory bandwidth](#memory-bandwidth) for [decode](#decode), native [FP8](#fp8) support, and enough [VRAM](#vram) that the [VRAM budget](#vram-budget) leaves real [KV cache capacity](#kv-cache-capacity) instead of a sliver. That last point compounds: more cache means more [concurrency](#concurrency), and more concurrency means better batching, so the throughput advantage is larger than the specification difference suggests.

It is not a fixed property of a card, which is why it has to be measured rather than looked up. The ranking depends on the model, the [inference engine](#inference-engine), the [quantization](#quantization), and above all the [workload shape](#workload-shape) — prefill-heavy traffic rewards arithmetic, decode-heavy traffic rewards bandwidth, and the same two cards can swap places between them. A [benchmark](#benchmark) on your own traffic — specifically a [concurrency sweep](#concurrency-sweep) — is the only way to settle it.

Two adjustments make the comparison fair. Use [goodput](#goodput) rather than raw throughput, since capacity that misses your latency targets is not capacity you can sell. And include [idle cost](#idle-cost): a card that is twice as fast finishes the same work in half the hours, which improves its position further on any workload that is not running flat out.

_Usage:_

"The older cards are half the price. Shouldn't we run more of those?"

"Benchmark both on our traffic. If the newer one does three times the tokens per second, it's cheaper per token and you need fewer of them to hit the same latency."

## Section 11 — Runpod

### Runpod

A cloud platform for renting [GPU](#gpu) compute. It offers the same hardware through several delivery models — dedicated instances you hold, serverless capacity that scales with demand, and managed multi-node environments — which makes it a convenient concrete example for the abstractions in this dictionary.

The two models you choose between cover the two shapes GPU work usually takes. A [Pod](#pod) is a machine you rent and keep: it stays yours until you stop it, and you are billed for that whole period regardless of use. A [serverless endpoint](#serverless-endpoint) is an API backed by [workers](#worker) that are created on demand and removed when traffic stops, billed by execution time. The first suits development, training, and steady production load; the second suits intermittent traffic, where [idle cost](#idle-cost) would otherwise dominate the bill. The trade between them is the [scale to zero](#scale-to-zero) question — idle cost against [cold start](#cold-start) — with [FlashBoot](#flashboot) narrowing the gap.

Around those sit the supporting pieces. A [Network Volume](#network-volume) holds [model weights](#model-weights) independently of any instance's lifecycle. A [Template](#template) captures a reusable environment definition. Instant Clusters provision several networked GPU machines together for distributed work that needs [RDMA](#rdma) between nodes. Flash is a Python framework for defining and running remote GPU workloads from local code, and `runpodctl` is the command line tool for driving all of it.

_Usage:_

"Should this run on a Pod or on Serverless?"

"How constant is the traffic? Steady load keeps a Pod busy and it's cheaper. A few hundred requests a day scattered around, and you're paying for idle GPU most of the time."

### Pod

A dedicated compute environment on [Runpod](#runpod) — CPU, one or more [GPUs](#gpu), memory, storage and networking — that you create and keep until you stop it. A GPU Pod is simply one with GPUs attached, which is the usual case for inference work.

The defining property is that it is yours continuously. Nothing scales it down, nothing reclaims it between requests, and you are billed for the whole time it exists rather than for the work it does. That makes it the right shape for anything with a long-running or interactive relationship to the hardware: development and experimentation, fine-tuning, notebook work, batch jobs, and production serving with steady enough traffic to keep the card busy. It is the wrong shape for sparse traffic, where [idle cost](#idle-cost) is most of the bill and a [serverless endpoint](#serverless-endpoint) fits better.

Because a Pod persists, [cold start](#cold-start) is a one-time cost rather than a recurring risk. The [model weights](#model-weights) load once and stay in [VRAM](#vram) for the life of the instance, so [TTFT](#ttft) has no startup component and [tail latency](#tail-latency) is not punctuated by workers booting. Local disk is ephemeral and disappears with the Pod, so anything worth keeping belongs on a [Network Volume](#network-volume).

GPU priority is worth knowing about when capacity is tight. Rather than requesting one specific card and waiting for it, you can give an ordered list of acceptable types, and the platform takes the highest available. Since specific GPUs are frequently unavailable, flexibility here is often the difference between starting now and queueing.

_Usage:_

"We spun up a Pod for the demo three weeks ago."

"Is it still running? A Pod bills until you stop it — that's three weeks of GPU whether anyone used it or not."

### Serverless endpoint

An API-facing resource on [Runpod](#runpod) backed by [workers](#worker) that are created when there is demand and removed when there is not. Serverless here means the usual thing: you define what a worker runs and the platform decides how many exist.

The billing model is what distinguishes it from a [Pod](#pod). You pay for execution time rather than for a reserved machine, so an endpoint receiving no traffic can cost nothing at all. For workloads that are intermittent — internal tools, early products, anything following office hours — this removes the [idle cost](#idle-cost) that otherwise makes GPU inference expensive out of proportion to its use.

What you accept in return is [cold start](#cold-start). When no worker is running, the first request waits for one to be provisioned, pull its [container image](#container-image), and load the [model weights](#model-weights) into [VRAM](#vram). [FlashBoot](#flashboot) reduces this by retaining reusable state, and an [active worker](#active-worker) removes it entirely at the cost of one always-on GPU, which is the standard compromise.

Configuration is mostly about bounding [autoscaling](#autoscaling): max workers caps how far it can scale out, GPUs per worker sets how many cards each one gets — more than one when [tensor parallelism](#tensor-parallelism) is needed — and an idle timeout decides how long a worker survives without traffic before being reclaimed. Two request models are available, [queue-based](#queue-based-endpoint) and [load-balancing](#load-balancing-endpoint), and they suit different kinds of work.

_Usage:_

"The endpoint costs nothing overnight, which is great, but the first morning request takes four minutes."

"That's the trade you accepted. Add one active worker — you'll pay for a single GPU around the clock and nobody waits for a boot."

### Queue-based endpoint

A [serverless endpoint](#serverless-endpoint) configuration where submitted requests go into a managed queue and are collected by [workers](#worker) as capacity frees up. The client submits, receives a job identifier, and either polls for the result or waits on it.

The queue is doing real work here, not just buffering. It absorbs bursts without dropping them, holds requests while [autoscaling](#autoscaling) provisions more workers, and survives a worker dying mid-job so the work can be retried elsewhere. That makes it a good fit for anything where completion matters more than immediacy: batch generation, transcription, image and video work, document processing, and any job long enough that a client would not hold a connection open for it anyway.

It also makes the platform's [queue depth](#queue-depth) the natural scaling signal — the number of waiting jobs is a direct measure of how much capacity is missing, and it moves before latency does.

Where it fits less well is interactive chat. Submit-then-poll adds a round trip before generation begins, which is added to [TTFT](#ttft), and polling is an awkward shape for token-by-token [streaming](#streaming). For a conversational product where the user is watching output appear, a [load-balancing endpoint](#load-balancing-endpoint) routes directly to a worker and holds one connection open, which is what streaming wants.

The dividing question is whether anyone is waiting on the response as it is produced. If the result is collected later, queue. If it is read as it arrives, route directly.

_Usage:_

"Chat responses feel laggy even though generation is fast."

"You're on a queue-based endpoint — submit, poll, then stream. For interactive traffic use load balancing so the connection goes straight to the worker."

### Load-balancing endpoint

A [serverless endpoint](#serverless-endpoint) configuration where requests are routed directly to an available [worker](#worker) and served over a single open connection, rather than being submitted to a queue and collected later.

It exists for interactive traffic. Because the connection stays open for the life of the request, [streaming](#streaming) works naturally — tokens are pushed as [decode](#decode) produces them, and the client renders them as they arrive. There is no submit-then-poll round trip inflating [TTFT](#ttft), which matters when the whole user experience is how quickly text starts appearing. This is the configuration a chat product or a coding assistant wants, and it is also what makes an [OpenAI-compatible API](#openai-compatible-api) behave the way clients expect.

The cost of directness is less absorption. A queue can hold a burst indefinitely while capacity arrives; direct routing has to place each request on a worker now, so a spike that outruns [autoscaling](#autoscaling) turns into rejections or waiting rather than into a growing backlog. [Backpressure](#backpressure) becomes something to configure rather than something the queue handles implicitly, and keeping an [active worker](#active-worker) matters more, since there is nowhere for requests to sit while one boots.

[Load balancing](#load-balancing) across workers is also doing more work here than a queue-based setup requires, because it has to choose a destination rather than letting workers pull when free — which is where request cost variance starts to matter.

_Usage:_

"Which endpoint type for the assistant?"

"Load balancing. You're streaming to someone watching the screen, so you want a direct connection and no polling round trip in front of it."

### Active worker

A [worker](#worker) on a [serverless endpoint](#serverless-endpoint) that is deliberately kept running rather than being reclaimed when traffic stops. It is the floor of the [autoscaling](#autoscaling) range: the minimum number of workers the platform maintains regardless of demand.

Its purpose is to remove the [cold start](#cold-start) from the path of the first request after a quiet period. On a pure [scale to zero](#scale-to-zero) endpoint, that request waits for a worker to be provisioned and for the [model weights](#model-weights) to load — minutes, landing on whoever happened to arrive first. Keeping one worker alive means that request is served immediately, and additional workers scale up behind it as normal.

Seen honestly it is a purchase rather than a waste. You are paying one GPU's [idle cost](#idle-cost) continuously and receiving predictable [tail latency](#tail-latency) in return. Whether that is worth it comes down to arrival patterns: sparse traffic with long gaps means most requests would otherwise arrive cold, which makes an active worker excellent value; steady traffic keeps a worker alive anyway, which makes it redundant. The characteristic symptom of not having one is a good [p50](#tail-latency) alongside a p99 measured in tens of seconds.

Two related settings frame it. Max workers caps how far the endpoint may scale out — the ceiling on both capacity and spend. GPUs per worker sets how many cards each worker holds, which needs raising above one when the model requires [tensor parallelism](#tensor-parallelism) to fit or to leave usable [KV cache capacity](#kv-cache-capacity).

_Usage:_

"Can we get the p99 down without giving up serverless?"

"One active worker. You'll pay for a single GPU all the time, but the requests that were hitting cold starts get served immediately."

### FlashBoot

[Runpod](#runpod)'s mechanism for reducing [cold start](#cold-start) latency on [serverless endpoints](#serverless-endpoint), by retaining reusable state from recently-run [workers](#worker) so that starting one again is not a boot from nothing.

The reasoning behind it is that most of a cold start is repeated work. Pulling the same [container image](#container-image), reading the same [model weights](#model-weights) off storage, and loading the same bytes into [VRAM](#vram) happens identically every time a worker for a given endpoint starts. Keeping that state warm and reusing it means a restart skips the parts that would produce a byte-for-byte identical result. A related idea applies to the weights themselves: a cached model kept close to the compute removes the download, which is often the largest single component — see [model cache](#model-cache).

It is worth being precise about what this does and does not change. FlashBoot shortens the cold start; it does not eliminate it, and it helps most when an endpoint has run recently enough for retained state to still exist. An endpoint idle for a long stretch, or one scaling into fresh capacity, is closer to a full start. So the underlying trade that [scale to zero](#scale-to-zero) describes — [idle cost](#idle-cost) against startup latency — is narrowed rather than removed, and an [active worker](#active-worker) remains the way to remove it outright.

The complementary work is on your side of the line. An image without weights baked in, weights on fast storage, and an [inference engine](#inference-engine) not doing lengthy compilation at startup all shorten what has to happen regardless of platform help.

_Usage:_

"FlashBoot is on and cold starts are still 40 seconds."

"It skips the repeated parts, not the whole thing. Check what your image weighs and whether the engine is capturing graphs at startup — that's on your side."

### Template

A saved, reusable description of how a [Runpod](#runpod) environment should be built: which [container image](#container-image) to run, what resources to allocate, which storage to mount, what environment variables and ports to configure, and what command to start.

The value is repeatability. Configuring a GPU environment by hand involves enough choices — image tag, [GPU](#gpu) type, disk sizes, [Network Volume](#network-volume) mount, [inference engine](#inference-engine) flags for [tensor parallelism](#tensor-parallelism) and memory fraction — that doing it twice reliably is unlikely and doing it ten times is not going to happen. A template makes the definition the artifact, so a [Pod](#pod) or a [serverless endpoint](#serverless-endpoint) created from it is identical to the last one.

It also makes environments reviewable. A change to the engine's memory fraction or to the model path is a change to a definition someone can read, rather than something typed into a form once and then forgotten. Anyone who has tried to work out why one worker behaves differently from another will recognise why that matters, and it is the same argument as for any infrastructure-as-code.

Templates handle the standard split between configuration and secrets. Model paths, [precision](#precision) settings and concurrency limits belong in the template; API keys and credentials are injected at runtime rather than embedded, since anything baked into an image or a shared definition is readable by whoever can access it.

_Usage:_

"The staging endpoint behaves differently and nobody knows why."

"Was it created from the same template? If someone set it up by hand, the engine flags or the GPU type will have drifted — that's what templates are for."

