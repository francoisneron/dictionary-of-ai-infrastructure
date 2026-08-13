---
description: An inference API following OpenAI's request and response shapes. The de facto standard that makes engines and providers swappable.
---

An HTTP interface that follows the request and response shapes OpenAI established — `/v1/chat/completions` taking a list of role-tagged messages, returning choices, and streaming deltas over server-sent events. Most [inference engines](./Inference%20engine.md) and most hosted providers expose one.

Its value is that it decouples the client from the deployment. Application code written against it can point at a hosted provider, a self-hosted [vLLM](./vLLM.md) instance, or a different engine entirely, by changing a base URL. That makes engine benchmarking cheap, gives you a fallback path when capacity runs short, and means the decision about where inference runs is not baked into the product. It also means the existing client libraries, retry logic and tooling all work unmodified.

Compatibility is a spectrum rather than a guarantee. The core chat and completion endpoints are reliable across implementations. Beyond that, support for tool calling, structured output, log probabilities, and the exact error and usage fields varies by engine and version. Anything outside the basic request path is worth verifying rather than assuming.

One detail matters more than it looks. The engine applies the model's chat template to turn the message list into the string the model expects, using the model's own config — see [tokenizer](./Tokenizer.md). Sending pre-formatted text through the plain completions endpoint instead bypasses that, and it is an easy way to get quietly worse output from a correctly deployed model.

_Usage:_

"Can we test whether the self-hosted setup is good enough before committing?"

"Both speak the OpenAI API, so point the base URL at yours and run the same eval. Nothing else in the client changes."
