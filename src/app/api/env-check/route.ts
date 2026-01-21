import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY),
    SYSADMIN_CODE: !!(process.env.SYSADMIN_CODE ?? process.env.NEXT_PUBLIC_SYSADMIN_CODE),
    VERISUM_ADMIN_CODE: !!(process.env.VERISUM_ADMIN_CODE ?? process.env.NEXT_PUBLIC_VERISUM_ADMIN_CODE),
  });
}
