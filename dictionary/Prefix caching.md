---
description: Reusing cached attention state across requests that share a prompt beginning. Turns repeated prefill into a lookup.
---

Reusing the [KV cache](./KV%20cache.md) computed for the beginning of one request when a later request starts with the same [tokens](./Token.md). The shared portion skips [prefill](./Prefill.md) entirely and is read from memory instead of recomputed.

It works because attention state for a token depends only on the tokens before it. If two requests share their first 2,000 tokens, the cache entries for those tokens are identical, so the second request can point at the same blocks — which is why [PagedAttention](./PagedAttention.md) made this cheap to implement. The match has to be an exact prefix; a single differing token at position 5 invalidates everything after it.

The gain is large in exactly the situations production workloads are made of. A system prompt shared across every request is prefilled once for the entire deployment. A multi-turn conversation re-sends the whole history on each turn, so every turn after the first is a prefix hit for everything except the newest message. Retrieval-augmented requests that share a document set hit on the retrieved context. In these cases [TTFT](./TTFT.md) drops from seconds to near-immediate and the [compute bound](./Compute%20bound.md) prefill work largely disappears.

Two things break it, and both are easy to do accidentally. Putting anything variable at the front of the prompt — a timestamp, a session ID, a per-user greeting — moves the divergence point to position zero and the cache never hits. And cached blocks are [evicted](./KV%20cache%20eviction.md) under memory pressure, so a busy deployment may lose entries it would have reused. Order prompts with the stable content first and the variable content last.

_Usage:_

"Prefix caching is on but the hit rate is basically zero."

"Something variable is at the top of the prompt. Move the timestamp to the end and put the system prompt first — it only matches exact prefixes."
