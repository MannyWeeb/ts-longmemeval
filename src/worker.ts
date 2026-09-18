import {chat} from "./provider";
import {get_cache, save_json, stringify_haystack_sessions, Timer} from "./utils"

const RESULT_DICT: Record<string, string> = {
  "full-history": process.env.FULL_HISTORY_RESULT??"",
  "oracle": process.env.ORACLE_RESULT??"",
  "bm25": process.env.BM25_RESULT??"",
}

const MODEL_DICT: Record<string, string> = {
  "full-history": process.env.FULL_HISTORY_MODEL??"",
  "oracle": process.env.ORACLE_MODEL??"",
  "bm25": process.env.BM25_MODEL??"",
}

export default async(run_type: string, batches: LongMemEvalQuestion[][])=>{
  const result_path = RESULT_DICT[run_type];
  const model = MODEL_DICT[run_type];
  console.log(`[worker]received ${batches.length} batch(es)`);
  console.log(`[worker]reader model: ${model}`);
  const cache = get_cache(result_path) || {};

  console.log(`[worker]cache-len ${Object.keys(cache).length}`)
  for(let i = 0; i < batches.length; i++){
    await Promise.allSettled(batches[i].map(async(q, q_i)=>{
      if(cache[q.question_id] && cache[q.question_id].end){
        //console.log(`[worker]cache-hit ${q.question_id} -> skipping`)
        return Promise.resolve();
      }

      const timer = new Timer();
      console.log(`[worker]executing ${q.question_id} ${i}:(${q_i}/${batches[i].length})`);
      const messages = build_message(run_type, q);
      const response = await chat(messages, { model });
      
      const result = {
        llm_answer: response!.text,
        question: q,
        run_type,
        completion_tokens: response!.completion_tokens,
        prompt_tokens: response!.prompt_tokens
      }

      save_json(`./artifacts/preflight-messages/${run_type}/sent-message-${q.question_id}.json`, messages);
      save_json(`./artifacts/postflight-responses/${run_type}/${q.question_id}.json`, result);

      cache[q.question_id] = {
        question: q.question,
        answer: q.answer,
        llm_answer: response ? response.text : "",
        question_type: q.question_type,
        start: new Date(timer.delta!).toISOString(),
        end: new Date().toISOString(),
        completion_tokens: response!.completion_tokens,
        prompt_tokens: response!.prompt_tokens
      };
      console.log(`[worker]finished ${q.question_id} ${i}:(${q_i}/${batches[i].length}) -> Duration: ${timer.toggle()}`);
      save_json(result_path, cache);
    }));
  }
}

function build_message(run_type: string, q: LongMemEvalQuestion):ChatMessage[]{
  switch(run_type){
    case "full-history": return [
      {
        role : "user",
        content:
          "Related Memories" +
          stringify_haystack_sessions(q) +
          "\n\n" +
          `Question: ${q.question}`
      }
    ]
    

    case "oracle": return [
      {
        role : "user",
        content:
          "Related Memories" +
          stringify_haystack_sessions(q) +
          "\n\n" +
          `Question: ${q.question}`
      }
    ]
    
    case "bm25":return [];

    default: return [];
  }
}