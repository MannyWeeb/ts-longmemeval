import {randomBytes} from "crypto";

const QORTEX_URL = process.env.QORTEX_URL ?? "http://localhost:7800/api/mcp";

export default class Qortex{
  constructor(private keys: ProvisionedScope){}

  async init(){
    const response = await fetch(QORTEX_URL, {
      method: "POST",
      headers: this.auth_headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: randomBytes(32),
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "qortex-longmem-eval",
            version: "1.0.0",
          },
        }
      })
    });

    if(!response.ok)throw new Error(`[qortex-mcp-init]Failed: ${response.status} ${await response.text()}`);

    const message = await parse_mcp_response(response);
  }

  call(tool_name: string, tool_args: object){

  }

  //Utils
  auth_headers(){
    return {
      "Content-Type"  : "application/json",
      "Accept"        : "application/json",
      "Authorization" : `Bearer ${this.keys.mcp_key}`
    }
  }

}

async function parse_mcp_response(res: Response): Promise<McpResponse|void>{
  const content_type = res.headers.get("content-type") ?? "";

  if(content_type.includes("application/json"))return res.json();

  if(content_type.includes("text/event-stream")){
    // Build SSE events
    const rx = await res.text();
    const msg: McpResponse[] = [];

    for(const block of rx.split(/\n\n+/)){
      const data_lines = block.split("\n").filter((v)=> v.startsWith("data:")).map((v)=> v.slice("data:".length).trim());

      for(const data of data_lines){
        if(!data || data === "[DONE")continue;

        try{
          msg.push(JSON.parse(data));
        }catch{
          // Just let em be
        }
      }
    }

    if(msg.length === 0)throw new Error(`[qortex-parse-response]MCP returned an SSE response with no JSON-RPC message`);

    return msg[msg.length-1];
  }
}