export const ALLOWED_DOMAIN = "rechroma.co.jp";

export const ACTIVE_STATUSES = ["実施中", "開始前", "社内クロージング中"] as const;

export const ROLE_LABELS: Record<string, string> = {
  "PM/Main": "PM・メイン兼任",
  PM: "PM",
  Main: "メイン",
  Sub: "サブ",
  Review: "レビュー",
  Support: "サポート",
};

// 役割バッジの表示色（Tailwindクラス）
export const ROLE_BADGE: Record<string, string> = {
  "PM/Main": "bg-indigo-100 text-indigo-800",
  PM: "bg-blue-100 text-blue-800",
  Main: "bg-emerald-100 text-emerald-800",
  Sub: "bg-amber-100 text-amber-800",
  Review: "bg-purple-100 text-purple-800",
  Support: "bg-gray-100 text-gray-600",
};

export const STATUS_BADGE: Record<string, string> = {
  実施中: "bg-emerald-100 text-emerald-800",
  開始前: "bg-blue-100 text-blue-800",
  社内クロージング中: "bg-amber-100 text-amber-800",
  案件終了: "bg-gray-100 text-gray-500",
  取り消し: "bg-red-100 text-red-600",
  不明: "bg-gray-100 text-gray-400",
};
