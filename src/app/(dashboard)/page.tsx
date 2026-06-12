import Link from "next/link";
import { fetchActiveData } from "@/lib/queries";
import { ROLE_BADGE, ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ROLE_ORDER = ["PM/Main", "PM", "Main", "Sub", "Review", "Support"];

export default async function DashboardPage() {
  const { projects, members, assignments } = await fetchActiveData();

  const projectById = new Map(projects.map((p) => [p.id, p]));

  // メンバーごとの稼働集計（アクティブ案件のみ）
  const workload = members
    .filter((m) => !m.is_sales)
    .map((member) => {
      const mine = assignments.filter(
        (a) => a.member_id === member.id && projectById.has(a.project_id),
      );
      const roleCounts: Record<string, number> = {};
      for (const a of mine) {
        roleCounts[a.role] = (roleCounts[a.role] ?? 0) + 1;
      }
      const projectCount = new Set(mine.map((a) => a.project_id)).size;
      const coreCount = new Set(
        mine
          .filter((a) => !["Review", "Support"].includes(a.role))
          .map((a) => a.project_id),
      ).size;
      return { member, roleCounts, projectCount, coreCount };
    })
    .filter((w) => w.projectCount > 0)
    .sort((a, b) => b.coreCount - a.coreCount || b.projectCount - a.projectCount);

  const maxCore = Math.max(...workload.map((w) => w.coreCount), 1);

  const statusCounts: Record<string, number> = {};
  for (const p of projects) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
  }

  // アサイン未登録のアクティブ案件（要対応）
  const assignedProjectIds = new Set(assignments.map((a) => a.project_id));
  const unassigned = projects.filter((p) => !assignedProjectIds.has(p.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">稼働ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-500">
          アクティブ案件（実施中・開始前・社内クロージング中）のアサイン状況
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="アクティブ案件" value={projects.length} />
        <SummaryCard label="実施中" value={statusCounts["実施中"] ?? 0} />
        <SummaryCard label="開始前" value={statusCounts["開始前"] ?? 0} />
        <SummaryCard
          label="アサイン未登録"
          value={unassigned.length}
          alert={unassigned.length > 0}
        />
      </div>

      {unassigned.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          アサイン未登録：
          {unassigned.map((p, i) => (
            <span key={p.id}>
              {i > 0 && "、"}
              <Link href="/projects" className="underline">
                #{p.id} {p.client_name}
              </Link>
            </span>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">メンバー</th>
              <th className="px-4 py-3 text-right font-medium">アサイン案件</th>
              <th className="px-4 py-3 text-right font-medium">
                実質稼働
                <span className="ml-1 font-normal text-gray-400">
                  (レビュー/サポート除く)
                </span>
              </th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                役割内訳
              </th>
              <th className="hidden w-48 px-4 py-3 font-medium md:table-cell">
                負荷
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {workload.map(({ member, roleCounts, projectCount, coreCount }) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/members/${member.id}`}
                    className="text-indigo-700 hover:underline"
                  >
                    {member.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {projectCount}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {coreCount}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {ROLE_ORDER.filter((r) => roleCounts[r]).map((role) => (
                      <span
                        key={role}
                        className={`rounded px-1.5 py-0.5 text-xs ${ROLE_BADGE[role]}`}
                      >
                        {ROLE_LABELS[role]} {roleCounts[role]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${(coreCount / maxCore) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          alert ? "text-amber-600" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
