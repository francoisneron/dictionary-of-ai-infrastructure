---
description: The unit a model reads and writes. Context window size, memory use, throughput, and cost are all counted in tokens.
---

The unit a model reads and writes. Roughly word-sized but not exactly — common words are one token, rare or long ones split into several. [Context window](./Context%20window.md) size, memory use, [throughput](./Throughput.md), and cost are all counted in tokens.

Text becomes tokens via a [tokenizer](./Tokenizer.md): a fixed vocabulary of tens of thousands of fragments that splits any input into a sequence of vocabulary entries. The model never sees characters or words. Every request is converted to tokens on the way in, processed during [prefill](./Prefill.md), and produced one at a time during [decode](./Decode.md) on the way out.

As a rule of thumb, a token is about three-quarters of an English word, so a thousand tokens is roughly 750 words. Code and structured data are less predictable. Common keywords tokenize compactly, while generated identifiers, hashes, and base64 blobs split into many tokens per "word". Text that appeared often in the tokenizer's source material gets short encodings; text that didn't gets chopped into pieces. This is why a small-looking payload full of UUIDs can occupy far more of the window than its size suggests.

Tokens are the unit the whole system is measured in, which is why they appear in nearly every other entry here. Each token in a sequence adds state to the [KV cache](./KV%20cache.md), so token count is what turns into GPU memory. Generation speed is quoted in tokens per second. Billing is normalized to [cost per million tokens](./Cost%20per%20million%20tokens.md). When sizing a deployment, the token count of a typical request — not the number of requests — is what decides how much hardware you need.

_Avoid:_ "word" — token boundaries don't match word boundaries, and every metric that matters is counted per token.

_Usage:_

"The prompt is only about 400 words, so we're fine on context."

"Run it through the tokenizer first. It's mostly JSON with UUIDs in it, and those split badly — could easily be double what you'd guess from the word count."
