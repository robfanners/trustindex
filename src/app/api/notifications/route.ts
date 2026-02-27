import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";

type Notification = {
  type: string;
  title: string;
  message: string;
  link: string;
  created_at: string;
};

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseServer();
  const notifications: Notification[] = [];
  const now = new Date().toISOString();

  // Overdue actions
  const { data: overdueActions } = await db
    .from("actions")
    .select("id, title, due_date")
    .eq("status", "open")
    .lt("due_date", now)
    .limit(10);

  if (overdueActions) {
    for (const a of overdueActions) {
      notifications.push({
        type: "overdue_action",
        title: "Overdue Action",
        message: a.title,
        link: `/actions/${a.id}`,
        created_at: a.due_date,
      });
    }
  }

  // Overdue reassessment policies
  const { data: overduePolicies } = await db
    .from("reassessment_policies")
    .select("id, system_id, next_due")
    .lt("next_due", now)
    .limit(10);

  if (overduePolicies) {
    for (const p of overduePolicies) {
      notifications.push({
        type: "overdue_reassessment",
        title: "Reassessment Overdue",
        message: `System ${p.system_id} reassessment due`,
        link: `/trustsys/${p.system_id}`,
        created_at: p.next_due,
      });
    }
  }

  // Recent drift events (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: driftEvents } = await db
    .from("drift_events")
    .select("id, system_id, created_at, drift_type")
    .gte("created_at", sevenDaysAgo)
    .limit(10);

  if (driftEvents) {
    for (const d of driftEvents) {
      notifications.push({
        type: "drift_event",
        title: "Trust Drift Detected",
        message: `${d.drift_type} drift on system ${d.system_id}`,
        link: `/trustsys/${d.system_id}`,
        created_at: d.created_at,
      });
    }
  }

  // Sort by created_at descending
  notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ notifications: notifications.slice(0, 20) });
}
