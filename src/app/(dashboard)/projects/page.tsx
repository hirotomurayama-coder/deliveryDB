import Link from "next/link";
import { fetchActiveData } from "@/lib/queries";
import { ROLE_BADGE, STATUS_BADGE } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ROLE_ORDER = ["PM/Main", "PM", "Main", "Sub", "Review", "Support"];

function endMonthKey(endDate: string | null): string {
  if (!endDate) return "終了日未設定";
  return endDate.slice(0, 7); // YYYY-MM
}

function formatMonth(key: string): string {
  if (key === "終了日未設定") return key;
  const [y, m] = key.split("-");
  return `${y}年${Number(m)}月末まで`;
}

export default async function ProjectsPage() {
  const { projects, members, menus, assignments, projectMenus } =
    await fetchActiveData();

  const memberById = new Map(members.map((m) => [m.id, m]));
  const menuById = new Map(menus.map((m) => [m.id, m]));

  // 終了月ごとにグルーピング（既存スプレッドシートの区切りを再現）
  const groups = new Map<string, typeof projects>();
  for (const p of projects) {
    const key = endMonthKey(p.end_date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === "終了日未設定") return 1;
    if (b === "終了日未設定") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">案件一覧</h1>
        <p className="mt-1 text-sm text-gray-500">
          アクティブ案件 {projects.length} 件（終了予定月順）
        </p>
      </div>

      {sortedKeys.map((key) => (
        <section key={key}>
          <h2 className="mb-2 border-b border-gray-300 pb-1 text-sm font-bold text-gray-700">
            {formatMonth(key)}
            <span className="ml-2 font-normal text-gray-400">
              {groups.get(key)!.length}件
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">顧客</th>
                  <th className="px-3 py-2 font-medium">支援内容</th>
                  <th className="px-3 py-2 font-medium">ステータス</th>
                  <th className="px-3 py-2 font-medium">期間</th>
                  <th className="px-3 py-2 font-medium">アサイン</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groups.get(key)!.map((p) => {
                  const pMenus = projectMenus
                    .filter((pm) => pm.project_id === p.id)
                    .map((pm) => menuById.get(pm.menu_id)?.name)
                    .filter(Boolean);
                  const pAssignments = assignments
                    .filter((a) => a.project_id === p.id)
                    .sort(
                      (a, b) =>
                        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
                    );
                  return (
                    <tr key={p.id} className="align-top hover:bg-gray-50">
                      <td className="px-3 py-2 tabular-nums text-gray-400">
                        {p.id}
                      </td>
                      <td className="px-3 py-2 font-medium">{p.client_name}</td>
                      <td className="px-3 py-2">
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {pMenus.map((m) => (
                            <span
                              key={m}
                              className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
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
                      <td className="px-3 py-2">
                        <div className="flex max-w-72 flex-wrap gap-1">
                          {pAssignments.length === 0 && (
                            <span className="text-xs text-amber-600">
                              未登録
                            </span>
                          )}
                          {pAssignments.map((a) => {
                            const m = memberById.get(a.member_id);
                            if (!m) return null;
                            return (
                              <Link
                                key={a.id}
                                href={`/members/${m.id}`}
                                className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs hover:opacity-75 ${ROLE_BADGE[a.role]}`}
                                title={a.role}
                              >
                                {m.name.split(" ")[0]}
                                <span className="opacity-60">
                                  ({a.role === "PM/Main" ? "PM/M" : a.role})
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
