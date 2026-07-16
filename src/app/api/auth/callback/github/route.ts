import { handleCallback } from "../_shared";

export async function GET(request: Request) {
  return handleCallback(request, "github");
}
