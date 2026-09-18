import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";


/* Start of File I/O */
export function get_cache(file_path: string) {
  const dir = dirname(file_path);
  if (!existsSync(dir))mkdirSync(dir, { recursive: true });
  if (!existsSync(file_path))writeFileSync(file_path, "{}", "utf-8");

  try{
    return JSON.parse(readFileSync(file_path, "utf-8"));
  }catch(error){
    return null
  }
}

export function read_json(file_dir: string){
  try{
    return JSON.parse(readFileSync(file_dir, "utf8"));
  }catch(err){
    console.error(`[read_json]Failed`, err);
    return null;
  }
}

export function save_json(file_path: string, obj: object){
  const dir = dirname(file_path);
  if(!existsSync(dir))mkdirSync(dir, { recursive: true });
  writeFileSync(file_path, JSON.stringify(obj, null, 2));
}
/* End of File I/O */

/* Start of API calls */
const REQUEST_TIMEOUT_MS = 500_000;
const BACKOFF_MS = 3000;
const MAX_RETRIES = 5;

export async function with_retry<T>(what: string, operation: (attempt:number)=> Promise<T>): Promise<T>{
  for(let attempt = 0; attempt <= MAX_RETRIES; attempt++){
    try{
      return await operation(attempt);
    }catch(err:any){
      const retryable = err instanceof ApiError ? err.retryable : !(err instanceof Error) || err.name !== "SyntaxError";
      
      if(!retryable || attempt >= MAX_RETRIES){
        console.log(`[API]${what}: Gave up after ${attempt} attempts`, err);
        throw err;
      }

      const retry_number = attempt+1;
      console.warn(`[API]${what}: attempt ${retry_number} failed, retrying in ${BACKOFF_MS}ms (${retry_number}/${MAX_RETRIES})${err.status ? ` | Code: ${err.status}` : ""}`);

      await new Promise((resolve)=> setTimeout(resolve, BACKOFF_MS));
    }
  }
  throw new Error(`${what} retry loop exited unexpectedly`);
}

export async function post_json(url: string, payload: any, what:string){
  return with_retry(what, async()=> {
    const controller = new AbortController();
    const timer = setTimeout(()=> controller.abort(), REQUEST_TIMEOUT_MS);

    try{
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...headers(),
          "Accept": "text/event-stream"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if(!res.ok){
        const body = await res.text();
        const code_is_retryable = res.status === 429 || res.status >= 500;
        throw new ApiError(`[API]${what} failed: ${res.status} ${describe_error(res.status, body)}`, res.status, code_is_retryable);
      }

      if(!res || !res.body)throw new Error("Response body is not available");

      if(payload.stream){
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let result = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const line = event.split("\n").find((line) => line.startsWith("data:"));
            if (!line) continue;

            const data = line.slice(5).trim();
            if (data === "[DONE]")return result;

            const chunk = JSON.parse(data);
            const token = chunk.choices?.[0]?.delta?.content;

            console.log(`[API]SSE:`, token);
            if (token)result += token;
          }
        }

        return result;
      }
      
      return await res.json();
    }catch(err){
      if(err instanceof Error && err.name === "AbortError"){
        throw new ApiError(`[API]${what} timed out after ${REQUEST_TIMEOUT_MS/1000}s:`, undefined, true);
      }

      throw err;
    }finally{
      clearTimeout(timer);
    }
  });
}

function headers(){
  const h:Record<string, string> = {"Content-Type": "application/json"};
  return h;
}

function describe_error(status: number, body: string):string{
  try{
    const parsed:any = JSON.parse(body);

    const err = parsed.error;
    const message = (typeof err === "object" ? err.message : err) ?? parsed.message;

    if(typeof message === "string")return message.trim();
  }catch(err){
    return "generic error";
  }

  return body.slice(0, 500);
}

class ApiError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryable = false){
    super(message);
    this.name = "ApiError";
  }
}
/* End of API calls */

/* Start of Prompt Processing */
export function batch(dataset: any[], batch_size: number):any[][]{
  console.log(`[builder]batch parameters: (dataset-size:${dataset.length}, batch-size:${batch_size})`)
  const result= [];
  for (let i = 0; i < dataset.length; i += batch_size) {result.push(dataset.slice(i, batch_size + i))}

  console.log(`[builder]produced ${result.length} batch(es)`)
  return result;
}

export function stringify_haystack_sessions({haystack_sessions, haystack_dates}: LongMemEvalQuestion){
  const has_matching_dates = haystack_dates && haystack_dates.length === haystack_sessions.length;
  if (!has_matching_dates)throw new Error("History/date length mismatch");
  
  const stack = haystack_sessions.map((v, i)=> ({
    date: haystack_dates ? haystack_dates[i] : "",
    sessions: v
  }));

  return stack.map((v, i)=> 
    `### Session ${v.date}\n` +
    JSON.stringify(v.sessions)
  ).join("\n\n");
}
/* End of Prompt Processing */

/* Start of simple-utils */
export class Timer{
  delta: number | null = null;

  constructor(){this.toggle()}

  toggle(){
    const span = this.delta ? (Date.now() - this.delta) : 0;
    this.delta = this.delta === null ? Date.now() : null;

    if(span)return format_duration(span);
  }
}

export function format_duration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const parts: string[] = [];

  if (h > 0) parts.push(`${h}hr${m !== 1 ? "s" : ""}`);
  if (m > 0) parts.push(`${m}min${m !== 1 ? "s" : ""}`);
  if (s > 0 || parts.length === 0)parts.push(`${s}sec${s !== 1 ? "s" : ""}`);

  return parts.join(" ");
}
/* End of simple utils */