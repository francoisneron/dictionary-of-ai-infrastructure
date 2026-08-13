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

<!-- TOC -->

<!-- CURRICULUM -->
