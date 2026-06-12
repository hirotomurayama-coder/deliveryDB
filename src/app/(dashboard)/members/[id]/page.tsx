import { notFound } from "next/navigation";
import { fetchMemberDetail } from "@/lib/queries";
import { ACTIVE_STATUSES, ROLE_BADGE, ROLE_LABELS, STATUS_BADGE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) notFound();

  const { member, assignments, skills, menus, projects } =
    await fetchMemberDetail(memberId);
  if (!member) notFound();

  const menuById = new Map(menus.map((m) => [m.id, m]));
  const roleByProject = new Map(assignments.map((a) => [a.project_id, a.role]));

  const activeProjects = projects.filter((p) =>
    (ACTIVE_STATUSES as readonly string[]).includes(p.status),
  );
  const pastProjects = projects.filter(
    (p) => !(ACTIVE_STATUSES as readonly string[]).includes(p.status),
  );

  const mainSkills = skills.filter((s) => s.level === "main");
  const subSkills = skills.filter((s) => s.level === "sub");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{member.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          アクティブ案件 {activeProjects.length} 件 / 過去案件{" "}
          {pastProjects.length} 件
        </p>
      </div>

      {skills.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-700">対応可能メニュー</h2>
          <div className="mt-3 space-y-2 text-sm">
            {mainSkills.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-xs text-gray-400">メイン以上可:</span>
                {mainSkills.map((s) => (
                  <span
                    key={s.menu_id}
                    className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800"
                  >
                    {menuById.get(s.menu_id)?.name}
                  </span>
                ))}
              </div>
            )}
            {subSkills.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-xs text-gray-400">サブ可:</span>
                {subSkills.map((s) => (
                  <span
                    key={s.menu_id}
                    className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
                  >
                    {menuById.get(s.menu_id)?.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <ProjectTable
        title="アクティブ案件"
        projects={activeProjects}
        roleByProject={roleByProject}
      />
      <ProjectTable
        title="過去案件"
        projects={pastProjects}
        roleByProject={roleByProject}
      />
    </div>
  );
}

function ProjectTable({
  title,
  projects,
  roleByProject,
}: {
  title: string;
  projects: {
    id: number;
    client_name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
  }[];
  roleByProject: Map<number, string>;
}) {
  if (projects.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-gray-700">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">顧客</th>
              <th className="px-3 py-2 font-medium">役割</th>
              <th className="px-3 py-2 font-medium">ステータス</th>
              <th className="px-3 py-2 font-medium">期間</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {projects.map((p) => {
              const role = roleByProject.get(p.id);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 tabular-nums text-gray-400">
                    {p.id}
                  </td>
                  <td className="px-3 py-2 font-medium">{p.client_name}</td>
                  <td className="px-3 py-2">
                    {role && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${ROLE_BADGE[role]}`}
                      >
                        {ROLE_LABELS[role]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${
                        STATUS_BADGE[p.status] ?? STATUS_BADGE["不明"]
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                    {p.start_date ?? "—"} 〜 {p.end_date ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
