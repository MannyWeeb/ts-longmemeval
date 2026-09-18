import {dataset} from "./file.js";
import {batch} from "./utils.js";
import worker from "./worker.js";

const SUPPORTED_RUN_TYPES = ["full-history", "oracle", "bm25"];

const args = process.argv.slice(2);
const SUPPORTED = args[0] && SUPPORTED_RUN_TYPES.includes(args[0]);
if(!SUPPORTED)throw new Error(`[Index]Benchmark run type is unsupported: ${args[0]}`);
const RUN_TYPE = args[0];

console.log(`LongMemEval Benchmark`);
console.log(`Run Type: ${RUN_TYPE}`);
// Load dataset
const data = await dataset(RUN_TYPE);

// Build evaluation context and assemble into batched workloads
const batches = batch(data, Number(process.env.READER_BATCH_SIZE ?? 2));

// Execute batched workloads in parallel (while caching and logging);
worker(RUN_TYPE, batches);