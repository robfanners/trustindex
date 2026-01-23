import { NextResponse } from "next/server";

type Role = "sysadmin" | "verisum";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    role?: Role;
    next?: string;
  };

  const role: Role = body.role === "sysadmin" ? "sysadmin" : "verisum";
  const next = body.next || "/admin/new-run";

  const expected =
    role === "verisum"
      ? process.env.VERISUM_ADMIN_CODE ?? process.env.NEXT_PUBLIC_VERISUM_ADMIN_CODE
      : process.env.SYSADMIN_CODE ?? process.env.NEXT_PUBLIC_SYSADMIN_CODE;

  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error: `Missing ${role === "verisum" ? "VERISUM_ADMIN_CODE/NEXT_PUBLIC_VERISUM_ADMIN_CODE" : "SYSADMIN_CODE/NEXT_PUBLIC_SYSADMIN_CODE"} on server`,
      },
      { status: 500 }
    );
  }

  if (!body.code || body.code !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, next });

  const requestUrl = new URL(req.url);
  const isHttps = requestUrl.protocol === "https:";
  const cookieName = role === "verisum" ? "ti_verisum_admin" : "ti_sysadmin";
  res.cookies.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
