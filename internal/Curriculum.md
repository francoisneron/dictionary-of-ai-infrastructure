## Section 1 — The Model and Its Tokens

- Model weights
- Parameter count
- Mixture of experts
- Active parameters
- Token
- Tokenizer
- Context window

## Section 2 — The Machine It Runs On

- GPU
- VRAM
- HBM
- Memory bandwidth
- Memory bound
- Compute bound
- CUDA
- GPU utilization

## Section 3 — Making It Fit

- Precision
- FP8
- Quantization
- VRAM budget
- CPU offload
- OOM

## Section 4 — How a Request Is Served

- Inference engine
- vLLM
- Forward pass
- Prefill
- Decode
- Streaming
- OpenAI-compatible API

## Section 5 — What You Measure

- Latency
- TTFT
- TPOT
- Throughput
- Tail latency
- Goodput

## Section 6 — The KV Cache & Batching

- KV cache
- KV cache capacity
- PagedAttention
- KV cache eviction
- Prefix caching
- KV cache quantization
- Batch size
- Continuous batching
- Chunked prefill
- Speculative decoding

## Section 7 — Splitting Across GPUs

- Model parallelism
- Tensor parallelism
- Pipeline parallelism
- Data parallelism
- Expert parallelism
- NCCL
- NVLink
- RDMA
- Communication overhead

## Section 8 — Serving Real Traffic

- Endpoint
- Worker
- Queue depth
- Concurrency
- Load balancing
- Backpressure
- Health check
- Timeout
- Saturation
- Autoscaling

## Section 9 — Getting the Model Onto the Machine

- Container image
- Model cache
- Network volume
- Model load time
- Cold start
- Scale to zero

## Section 10 — Benchmarking & What It Costs

- Benchmark
- Workload shape
- Concurrency sweep
- GPU hour
- Idle cost
- Cost per million tokens
- Price performance

## Section 11 — Runpod

- Runpod
- Pod
- Serverless endpoint
- Queue-based endpoint
- Load-balancing endpoint
- Active worker
- FlashBoot
- Template
