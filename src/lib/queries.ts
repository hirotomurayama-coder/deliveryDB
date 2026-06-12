import { createClient } from "@/lib/supabase/server";
import { ACTIVE_STATUSES } from "@/lib/constants";
import type {
  Assignment,
  Member,
  Menu,
  Project,
  ProjectMenu,
  Skill,
} from "@/lib/types";

/** ダッシュボード・案件一覧で共通に使うアクティブ案件データ一式 */
export async function fetchActiveData() {
  const supabase = await createClient();

  const [projectsRes, membersRes, menusRes] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .in("status", [...ACTIVE_STATUSES])
      .order("end_date", { ascending: true, nullsFirst: false }),
    supabase.from("members").select("*").order("name"),
    supabase.from("menus").select("*"),
  ]);

  const projects = (projectsRes.data ?? []) as Project[];
  const members = (membersRes.data ?? []) as Member[];
  const menus = (menusRes.data ?? []) as Menu[];

  const projectIds = projects.map((p) => p.id);

  const [assignmentsRes, projectMenusRes] = await Promise.all([
    supabase.from("assignments").select("*").in("project_id", projectIds),
    supabase.from("project_menus").select("*").in("project_id", projectIds),
  ]);

  const assignments = (assignmentsRes.data ?? []) as Assignment[];
  const projectMenus = (projectMenusRes.data ?? []) as ProjectMenu[];

  return { projects, members, menus, assignments, projectMenus };
}

export async function fetchMemberDetail(memberId: number) {
  const supabase = await createClient();

  const [memberRes, assignmentsRes, skillsRes, menusRes] = await Promise.all([
    supabase.from("members").select("*").eq("id", memberId).single(),
    supabase.from("assignments").select("*").eq("member_id", memberId),
    supabase.from("skills").select("*").eq("member_id", memberId),
    supabase.from("menus").select("*"),
  ]);

  const member = memberRes.data as Member | null;
  const assignments = (assignmentsRes.data ?? []) as Assignment[];
  const skills = (skillsRes.data ?? []) as Skill[];
  const menus = (menusRes.data ?? []) as Menu[];

  const projectIds = assignments.map((a) => a.project_id);
  const { data: projectsData } = await supabase
    .from("projects")
    .select("*")
    .in("id", projectIds)
    .order("end_date", { ascending: false, nullsFirst: false });

  const projects = (projectsData ?? []) as Project[];

  return { member, assignments, skills, menus, projects };
}
