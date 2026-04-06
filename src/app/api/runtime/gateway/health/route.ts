import { GET as getGatewayHealth } from "../../../openclaw/gateway/health/route";

export const runtime = "nodejs";

export async function GET() {
  return getGatewayHealth();
}
