---
description: Software that turns text into token IDs and back. Its vocabulary decides how many tokens any given input costs you.
---

The software that converts text into the numeric IDs a model consumes, and converts generated IDs back into text. It ships with the [model weights](./Model%20weights.md) and is specific to them — the wrong tokenizer produces fluent nonsense rather than an error.

A tokenizer holds a fixed vocabulary, typically 32,000 to 256,000 entries, learned before training by finding the fragments that most efficiently encode a large body of text. Encoding is a lookup: the text is split into the longest vocabulary entries that match, and each becomes a [token](./Token.md) ID. Two markers usually bracket the sequence — a beginning-of-sequence token, and an end-of-sequence token the model emits to say it is finished, which is what actually stops [decode](./Decode.md).

Chat models add a layer on top. A chat template turns a list of role-tagged messages into the exact string the model was trained on, with its own delimiters around each turn. Getting this wrong is a common and quiet failure: the model still responds, just worse, because the input no longer looks like anything it saw in training. Serving through an [OpenAI-compatible API](./OpenAI-compatible%20API.md) usually means the [inference engine](./Inference%20engine.md) applies the template for you from the model's own config.

Vocabulary size has a direct infrastructure cost. A tokenizer that encodes your text inefficiently produces more tokens for the same content, which means more [prefill](./Prefill.md) work, more [KV cache](./KV%20cache.md), and a larger bill for identical input. This is worth checking when serving non-English text, where vocabularies trained mostly on English can be two or three times less efficient.

_Usage:_

"Same prompt, same length, but the Japanese requests cost twice as much."

"Check the token counts, not the character counts. That tokenizer is English-heavy, so it splits Japanese into far more tokens."
