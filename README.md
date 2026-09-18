# LongMemEval TS Port
A FULLY handwritten port of the excellent LongMemEval benchmark in Typescript.

## Features:
* Fully Typed
* Configurable Parallel Batching
* Greedy Caching - Results are saved immediately to avoid costly reruns
* Retry + Backoff API Calls

Currently only for personal use, mainly for Qortex (a custom memory layer) benchmarks so coverage may vary for now.

## What IS ported:
* Full-Session Test
* Oracle Test
* Judge QA Script - The thing that judges the test results


### Data
```
mkdir -p data/
cd data/
wget https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_oracle.json
wget https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_s_cleaned.json
wget https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_m_cleaned.json
cd ..
```

## References:
Folder Structure:
* artifacts - per test-type log artifacts such as raw message sent to llm, raw response, etc for debugging and provenance
* data - Should contain the datasets to be used in the benchmark
* results - Output of each test-case lives here, greedily cached by the worker

Disclaimer: Poorly documented, but each function and variable should be self-descriptive by itself, in any case, please reach out to me if any peeps plan to use this for their purposes