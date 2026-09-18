declare interface HaystackTurn {
  role: "user" | "assistant";
  content: string;
}

declare type EvalCase = {
  question: string;
  answer: string;
  llm_answer: string;
  question_type: string;
  start: string;
  end: string
}

declare type JudgeCase = {
  question: string;
  answer: string;
  hypothesis: string;
  question_type: string;
  autoeval_label: {
    model: string;
    label: boolean;
  };
}

declare interface LongMemEvalQuestion {
  question_id: string;
  question_type: QuestionType;
  question: string;
  answer: string;
  question_date?: string;
  haystack_session_ids: string[];
  haystack_dates?: string[];
  haystack_sessions: HaystackTurn[][];
}

declare type QuestionType =
  | "single-session-user"
  | "single-session-assistant"
  | "single-session-preference"
  | "temporal-reasoning"
  | "knowledge-update"
  | "multi-session";

declare type RunLogRow = {
  question_id: string;
  question_type: QuestionType;
  abstention: boolean;
  condition: string;
  question: string;
  answer_text: string;
  gold_answer: string;
  retrieval_hit: boolean | null; // qortex only
  tool_call_success: boolean | null; // qortex only
  tokens_prompt: number;
  tokens_completion: number;
  tokens_fetch_overhead: number | null; // qortex only
  tokens_report_overhead: number | null; // qortex only, summed across replayed turns
  latency_ms: number;
  org_id?: string;
  agent_id?: string;
}

declare interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  function_call?: object;
  tool_calls?: NativeToolCall[];
  tool_call_id?: string;
  tool_call_name?: string;
}

declare interface ChatOptions {
  tools?: any[];
  model: string;
  temperature?: number;
  handle_tool?: ToolHandler;
  max_tool_rounds?: number;
  /**
    * Forwarded as the request's `tool_choice`. Defaults to `"auto"`
    * whenever `tools` is non-empty, since native tool calling only
    * reliably engages when the server is explicitly told it's allowed to
    * pick a tool — omitting it causes some backends to silently ignore
    * `tools` and never return `tool_calls` at all.
  */
  tool_choice?: "auto" | "none" | "required" | {
    type: "function";
    function: { name: string };
  };
}

interface McpResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpSession {
  sessionId: string;
}


declare interface NativeToolCall {
  type?: "function" | string;
  id?: string;
  function?: {
    name: string;
    arguments: string;
  };
}

declare interface GenResult {
  text: string;
  tool_calls: NativeToolCall[] | null;
  prompt_tokens: number;
  completion_tokens: number;
  duration_ms: number;
}

declare interface ToolExecutionContext {
  call: NativeToolCall;
  messages: ChatMessage[];
}

declare type ToolHandler = (tool_name, tool_args: object, context: ToolExecutionContext) => Promise<unknown>;