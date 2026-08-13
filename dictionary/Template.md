---
description: A reusable definition of how a Runpod environment is created — image, resources, storage, environment variables.
---

A saved, reusable description of how a [Runpod](./Runpod.md) environment should be built: which [container image](./Container%20image.md) to run, what resources to allocate, which storage to mount, what environment variables and ports to configure, and what command to start.

The value is repeatability. Configuring a GPU environment by hand involves enough choices — image tag, [GPU](./GPU.md) type, disk sizes, [Network Volume](./Network%20volume.md) mount, [inference engine](./Inference%20engine.md) flags for [tensor parallelism](./Tensor%20parallelism.md) and memory fraction — that doing it twice reliably is unlikely and doing it ten times is not going to happen. A template makes the definition the artifact, so a [Pod](./Pod.md) or a [serverless endpoint](./Serverless%20endpoint.md) created from it is identical to the last one.

It also makes environments reviewable. A change to the engine's memory fraction or to the model path is a change to a definition someone can read, rather than something typed into a form once and then forgotten. Anyone who has tried to work out why one worker behaves differently from another will recognise why that matters, and it is the same argument as for any infrastructure-as-code.

Templates handle the standard split between configuration and secrets. Model paths, [precision](./Precision.md) settings and concurrency limits belong in the template; API keys and credentials are injected at runtime rather than embedded, since anything baked into an image or a shared definition is readable by whoever can access it.

_Usage:_

"The staging endpoint behaves differently and nobody knows why."

"Was it created from the same template? If someone set it up by hand, the engine flags or the GPU type will have drifted — that's what templates are for."
