import { NextResponse } from "next/server";
import { listOAuthAccounts, DEMO_USER_ID, getUser } from "@/lib/db";
import { isDemoMode } from "@/lib/config";

export async function GET() {
  const userId = DEMO_USER_ID;
  const [user, accounts] = await Promise.all([
    getUser(userId),
    listOAuthAccounts(userId),
  ]);
  return NextResponse.json({
    user,
    accounts,
    demoMode: isDemoMode(),
  });
}
