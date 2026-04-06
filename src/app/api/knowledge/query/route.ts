import { POST as queryKnowledge } from "../../openclaw/vault/query/route";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return queryKnowledge(req);
}
