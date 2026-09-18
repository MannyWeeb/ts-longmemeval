import {chat} from "./provider";
import {batch, get_cache, read_json, save_json, Timer} from "./utils"
import * as np from 'numpy-ts';

const SUPPORTED_RUN_TYPES = ["full-history", "oracle"];
const RESULT_DICT: Record<string, string> = {
  "full-history": process.env.FULL_HISTORY_RESULT??"",
  "oracle": process.env.ORACLE_RESULT??"",
  "bm25": process.env.BM25_RESULT??"",
  "judge": process.env.JUDGE_RESULT??"",
}
const MODEL_DICT: Record<string, string> = {
  "full-history": process.env.FULL_HISTORY_MODEL??"",
  "oracle": process.env.ORACLE_MODEL??"",
  "bm25": process.env.BM25_MODEL??"",
}

const args = process.argv.slice(2);
const SUPPORTED = args[0] && SUPPORTED_RUN_TYPES.includes(args[0]);
if(!SUPPORTED)throw new Error(`[Index]Benchmark run type is unsupported: ${args[0]}`);
const RUN_TYPE = args[0];

const cache:Record<string, JudgeCase> = get_cache(RESULT_DICT["judge"]) || {};
const data = await read_json(RESULT_DICT[RUN_TYPE]);

const batches:Array<[string, EvalCase]>[] = batch(data, Number(process.env.JUDGE_BATCH_SIZE ?? 2));

const model = MODEL_DICT[RUN_TYPE];

for(let i = 0; i < batches.length; i++){
  await Promise.allSettled(batches[i].map(async(q, q_i)=>{
    const [question_id, eval_case] = q;

    if(cache[question_id]){
      console.log(`[judge]cache-hit ${question_id} -> skipping`)
      return Promise.resolve();
    }

    const timer = new Timer();
    console.log(`[judge]executing ${question_id} ${i}:(${q_i}/${batches[i].length})`);
    if(question_id.includes("_abs"))eval_case.question_type = "abstention";
    const messages:ChatMessage[] = [{ role : "user", content: judge_prompt(eval_case.question_type, eval_case) }];
    const response = await chat(messages, { model })

    cache[question_id] = {
      question       : eval_case.question,
      answer         : eval_case.answer,
      hypothesis     : eval_case.llm_answer,
      question_type  : eval_case.question_type,
      autoeval_label : {model, label: Boolean(response && response.text.toLowerCase().includes("yes"))}
    };

    console.log(`[judge]finished ${question_id} ${i}:(${q_i}/${batches[i].length}) -> Duration: ${timer.toggle()}`)
    save_json(RESULT_DICT[RUN_TYPE], cache);
  }));
}

const mean = np.mean(np.array(Object.values(cache).map(x => x.autoeval_label.label ? 1 : 0)));
console.log("[judge]Mean:", mean);
console.log("[judge]Accuracy:", Math.round(Number(mean.toString()) * 10_000) / 10_000);

// print_qa_metrics.py
let all_bucket:any[] = [], task_bucket:any[] = [];
const question_buckets:Record<string, number[]> = Object.fromEntries(["single-session-user", "single-session-preference", "single-session-assistant", "multi-session", "temporal-reasoning", "knowledge-update", "abstention"].map((v)=> [v, []]));
Object.values(cache).forEach((v)=> question_buckets[v.question_type].push(v.autoeval_label.label ? 1 : 0));

Object.entries(question_buckets).forEach(([bucket_name, results])=> {
  if(bucket_name === "abstention")return;
  const mean = np.array(results);
  // @ts-ignore
  console.log(`${bucket_name}: ${np.round(np.mean(mean), 4)} (${results.length})`);
  all_bucket  = all_bucket.concat(results);
  task_bucket = task_bucket.concat(mean);
});

console.log(
  //@ts-ignore
  "Task-averaged accuracy: ", np.round(np.mean(task_bucket), 4) + "\n" +
  //@ts-ignore
  "Overall accuracy:", np.round(np.mean(all_bucket), 4) + "\n" +
  //@ts-ignore
  "Abstention accuracy:", np.round(np.mean(question_buckets["abstention"]), 4)
)

// Pulled directly off of evaluate_qa.py btw so should be faithful
function judge_prompt(question_type: string, eval_case: EvalCase){
  const is_haystack_test = ["single-session-user", "single-session-assistant", "multi-session"].includes(question_type);
  const { question, answer, llm_answer } = eval_case;
  
  if(is_haystack_test)return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. \n\nQuestion: ${question}\n\nCorrect Answer: ${answer}\n\nModel Response: ${llm_answer}\n\nIs the model response correct? Answer yes or no only.`;

  switch(question_type){
    case "temporal-reasoning"        : return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. In addition, do not penalize off-by-one errors for the number of days. If the question asks for the number of days/weeks/months, etc., and the model makes off-by-one errors (e.g., predicting 19 days when the answer is 18), the model's response is still correct. \n\nQuestion: ${question}\n\nCorrect Answer: ${answer}\n\nModel Response: ${llm_answer}\n\nIs the model response correct? Answer yes or no only.`;
    case "knowledge-update"          : return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response contains some previous information along with an updated answer, the response should be considered as correct as long as the updated answer is the required answer.\n\nQuestion: ${question}\n\nCorrect Answer: ${answer}\n\nModel Response: ${llm_answer}\n\nIs the model response correct? Answer yes or no only.`;
    case "single-session-preference" : return `I will give you a question, a rubric for desired personalized response, and a response from a model. Please answer yes if the response satisfies the desired response. Otherwise, answer no. The model does not need to reflect all the points in the rubric. The response is correct as long as it recalls and utilizes the user's personal information correctly.\n\nQuestion: ${question}\n\nRubric: ${answer}\n\nModel Response: ${llm_answer}\n\nIs the model response correct? Answer yes or no only.`; 
    case "abstention":                 return `I will give you an unanswerable question, an explanation, and a response from a model. Please answer yes if the model correctly identifies the question as unanswerable. The model could say that the information is incomplete, or some other information is given but the asked information is not.\n\nQuestion: ${question}\n\nExplanation: ${answer}\n\nModel Response: ${llm_answer}\n\nDoes the model correctly identify the question as unanswerable? Answer yes or no only.`;
    
    default: throw new Error(`[judge]Unknown question_type to evaluate`);
  }
}