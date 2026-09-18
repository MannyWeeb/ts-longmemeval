declare interface ProvisionedScope {
  run_id: string;
  tenant: { id: string; name: string; slug: string };
  organization: { id: string; name: string; slug: string };
  agent: { id: string; name: string };
  mcp_key: string;
  mcp_key_id: string;
}

declare interface ProvisioningManifest {
  results: ProvisionedScope[];
  failures: { run_id: string; error: string }[];
}

declare interface FetchMemoryResult {
  hits: {
    content: string;
    score: number;
  }[];
  promptTokens?: number;
  completionTokens?: number;
}

declare interface TurnReportResult {
  accepted: boolean;
  promptTokens?: number;
  completionTokens?: number;
}

