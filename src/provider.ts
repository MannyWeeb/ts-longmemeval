import {post_json} from "./utils";

const PROVIDER_ENDPOINT_URL = process.env.PROVIDER_ENDPOINT_URL ?? "";
const MAX_TOOL_ROUNDS = 8;

export async function chat(messages: ChatMessage[], options: ChatOptions):Promise<GenResult|void>{
  const message_stack = [...messages];
  const max_tool_rounds = options.max_tool_rounds ?? MAX_TOOL_ROUNDS;
  
  let total_prompt_tokens = 0, total_completion_tokens = 0;
  for(let round = 0; round <= max_tool_rounds; round++){
    const start = Date.now();
    const completion_options = {model: options.model, temperature: options.temperature || 0, messages: message_stack, tools: options.tools, stream: false};
    const response = await post_json(`${PROVIDER_ENDPOINT_URL}/chat/completions`, completion_options, "Completions API");
    const choice = response.choices.pop();
    const message = choice.message ?? {};

    const usage = response.usage ?? {};
    total_prompt_tokens += usage.prompt_tokens ?? 0;
    total_completion_tokens += usage.completion_tokens ?? 0;

    const text = message.content ?? message.reasoning_content ?? "";

    const tool_calls : NativeToolCall[] | null = Array.isArray(message.tool_calls) && message.tool_calls.length > 0 ? message.tool_calls : null;
    
    if(tool_calls && options.handle_tool){ 
      message_stack.push({role:"assistant", tool_calls});
      for(const call of tool_calls){
        if(call.function){
          console.log(`[provider]fn call`, call.function.name);
          
          const tool_result = await options.handle_tool(call.function.name, JSON.parse(call.function.arguments), {call, messages: message_stack});
          message_stack.push({role:"tool", content: JSON.stringify(tool_result) || "No result"});
        }
      }
    }

    if(choice.finish_reason === "stop")return { text, tool_calls, completion_tokens: total_completion_tokens, prompt_tokens: total_prompt_tokens, duration_ms: Date.now()-start }
  }
}