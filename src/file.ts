import {get_cache, save_json, read_json} from "./utils";

const CACHE_DICT: Record<string, string> = {
  "full-history" : process.env.FULL_HISTORY_RESULT ?? "",
  "oracle"       : process.env.ORACLE_RESULT ?? "",
  "bm25"         : process.env.BM25_RESULT ?? "",
  "judge"        : process.env.JUDGE_RESULT ?? ""
}
const DATASET_DICT: Record<string, string> = {
  "full-history"  : process.env.FULL_HISTORY_DATA ?? "",
  "oracle"        : process.env.ORACLE_DATA ?? "",
  "bm25"          : process.env.BM25_DATA ?? "",
}

export function cache(run_type: string){
  const path = CACHE_DICT[run_type];
  return {
    load: ()=> get_cache(path),
    save: (obj: any)=> save_json(path, obj)
  }
}

export function dataset(run_type: string){
  const path = DATASET_DICT[run_type];
  const temp = read_json(path);

  return process.env.SAMPLE_SIZE ? temp.slice(0, process.env.SAMPLE_SIZE) : temp;
}