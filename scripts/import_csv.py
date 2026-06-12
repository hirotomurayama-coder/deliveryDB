#!/usr/bin/env python3
"""既存スプレッドシートのCSVをクレンジングし、Supabase投入用SQLを生成する。

入力: data/raw/*.csv（gitignore対象。顧客・金額情報を含むためコミットしない）
出力: data/seed/*.sql

使い方:
    python3 scripts/import_csv.py
生成されたSQLを 01→07 の順でSupabaseに適用する。
"""
import csv
import re
import sys
from calendar import monthrange
from datetime import date
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
SEED = Path(__file__).resolve().parent.parent / "data" / "seed"

ROLES = {"PM", "Main", "Sub", "Review", "Support", "PM/Main"}
PROJECT_STATUSES = {"実施中", "開始前", "案件終了", "社内クロージング中", "取り消し"}

# 支援メニューの表記ゆれ統一マップ（キー: 出現表記 → 値: 正規名のリスト）
MENU_ALIASES = {
    "SBT": ["SBTi"],
    "Scope1,2（6.5ガス含む）": ["Scope1・2"],
    "Scope1/2/3算定": ["Scope1・2", "Scope3"],
    "CDP（水）": ["CDP（水セキュリティ）"],
    "CFP": ["PCF（製品カーボンフットプリント）"],
    "TCFD（SSBJ/IFRS）": ["TCFD"],
    "削減貢献量": ["削減貢献量（WBCSD、GXリーグ）"],
    "ecovadis": ["EcoVadis"],
    "省エネ法対応": ["省エネ法・温対法"],
    "ICP": ["内部炭素価格（ICP）"],
    "【研修】": ["研修"],
    "オンサイト研修": ["研修"],
    "オンライン研修": ["研修"],
    "e-Learning": ["e-Learning"],
    "ELearning": ["e-Learning"],
}
MENU_SKIP = {"月額", "※管理会計用ダミー明細※", ""}


def norm_name(s: str) -> str:
    """氏名の空白ゆれ（全角空白・末尾空白・連続空白）を統一する。"""
    return re.sub(r"\s+", " ", s.replace("　", " ")).strip()


def norm_menus(raw: str) -> list[str]:
    raw = raw.strip()
    if raw in MENU_ALIASES:  # 「Scope1,2（6.5ガス含む）」等、名称自体にカンマを含むものを先に解決
        return list(MENU_ALIASES[raw])
    out = []
    for part in raw.split(","):
        m = part.strip()
        if m in MENU_SKIP:
            continue
        out.extend(MENU_ALIASES.get(m, [m]))
    return out


def parse_date(s: str, ref_year: int | None = None) -> date | None:
    s = (s or "").strip()
    if not s:
        return None
    try:
        nums = [int(p) for p in re.split(r"[/\-.]", s)]
    except ValueError:
        return None
    if len(nums) == 3:
        y, m, d = nums
        if y < 1900 or not 1 <= m <= 12:
            return None
        return date(y, m, min(d, monthrange(y, m)[1]))
    if len(nums) == 2:
        a, b = nums
        if a >= 1900 and 1 <= b <= 12:  # 年/月 のみ → 月初
            return date(a, b, 1)
        if ref_year and 1 <= a <= 12:  # 月/日 のみ → 開始日の年を補完
            return date(ref_year, a, min(b, monthrange(ref_year, a)[1]))
    return None


def parse_int(s: str) -> int | None:
    s = re.sub(r"[¥,\s]", "", s or "")
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    return None


def q(s: str | None) -> str:
    if s is None or s == "":
        return "null"
    # セル内改行はSQLの行構造を壊すため空白に置換する
    s = re.sub(r"[\r\n]+", " ", s)
    return "'" + s.replace("'", "''") + "'"


def lit(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, date):
        return f"'{v.isoformat()}'"
    return q(str(v))


def read(name: str) -> list[list[str]]:
    with open(RAW / name, newline="", encoding="utf-8") as f:
        return list(csv.reader(f))


def main() -> None:
    SEED.mkdir(parents=True, exist_ok=True)

    # ---------- clients ----------
    clients = {}
    for row in read("clients.csv")[2:]:
        if len(row) < 18 or not re.fullmatch(r"\d+", row[0].strip()):
            continue
        cid = int(row[0])
        name = row[1].strip()
        if not name:
            continue
        clients[cid] = {
            "id": cid,
            "name": name,
            "abbreviation": row[2].strip(),
            "status": row[3].strip() or row[17].strip(),
            "category": row[5].strip(),
            "industry": row[6].strip(),
        }

    # ---------- projects ----------
    projects = {}
    project_menus: set[tuple[int, str]] = set()
    for row in read("projects.csv")[2:]:
        if len(row) < 17 or not re.fullmatch(r"\d+", row[1].strip()):
            continue
        if not row[3].strip():  # 顧客名が空＝採番済みの空行はスキップ
            continue
        pid = int(row[1])
        start = parse_date(row[8])
        end = parse_date(row[9], ref_year=start.year if start else None)
        cid = parse_int(row[2])
        projects[pid] = {
            "id": pid,
            "client_id": cid if cid in clients else None,
            "client_name": row[3].strip(),
            "status": row[14].strip() if row[14].strip() in PROJECT_STATUSES else "不明",
            "consulting_type": row[6].strip() or None,
            "amount_jpy": parse_int(row[7]),
            "start_date": start,
            "end_date": end,
            "support_months": None,
            "pm_name": norm_name(row[15]) or None,
            "sales_name": row[16].strip() or None,
            "notes": row[13].strip() or None,
            "contract_url": row[11].strip() if row[11].strip().startswith("http") else None,
        }
        for m in norm_menus(row[5]):
            project_menus.add((pid, m))

    # ---------- assignment_current（現況マトリクス） ----------
    rows = read("assignment_current.csv")
    short_hdr, full_hdr = rows[1], rows[2]
    member_cols = {}
    for i in range(10, len(short_hdr)):
        nm = norm_name(full_hdr[i]) if i < len(full_hdr) and full_hdr[i].strip() else norm_name(short_hdr[i])
        if nm:
            member_cols[i] = nm

    assignments: set[tuple[int, str, str]] = set()
    for row in rows[3:]:
        if len(row) < 10 or not re.fullmatch(r"\d+", row[3].strip()):
            continue
        pid = int(row[3])
        status = row[6].strip()
        start = parse_date(row[8])
        end = parse_date(row[9], ref_year=start.year if start else None)
        months = parse_int(row[7])
        if pid not in projects:
            projects[pid] = {
                "id": pid, "client_id": None, "client_name": row[4].strip() or "不明",
                "status": status if status in PROJECT_STATUSES else "不明",
                "consulting_type": None, "amount_jpy": None,
                "start_date": start, "end_date": end, "support_months": months,
                "pm_name": None, "sales_name": None,
                "notes": row[1].strip() or None, "contract_url": None,
            }
        else:
            p = projects[pid]
            if status in PROJECT_STATUSES:
                p["status"] = status  # 現況シートのステータスを優先
            p["support_months"] = months
            if start:
                p["start_date"] = start
            if end:
                p["end_date"] = end
        for m in norm_menus(row[5]):
            project_menus.add((pid, m))
        for i, nm in member_cols.items():
            if i < len(row) and row[i].strip() in ROLES:
                assignments.add((pid, nm, row[i].strip()))

    # ---------- assignment_history ----------
    for row in read("assignment_history.csv")[1:]:
        if len(row) < 6:
            continue
        pid_s, name, role = row[0].strip(), norm_name(row[3]), row[4].strip()
        if not re.fullmatch(r"\d+", pid_s) or not name or name == "#N/A" or role not in ROLES:
            continue
        pid = int(pid_s)
        if pid not in projects:
            status = row[5].strip()
            projects[pid] = {
                "id": pid, "client_id": None, "client_name": row[1].strip() or "不明",
                "status": status if status in PROJECT_STATUSES else "不明",
                "consulting_type": None, "amount_jpy": None,
                "start_date": None, "end_date": None, "support_months": None,
                "pm_name": None, "sales_name": None, "notes": None, "contract_url": None,
            }
        assignments.add((pid, name, role))

    # ---------- skills ----------
    rows = read("skills.csv")
    skill_members = [norm_name(c) for c in rows[1][3:9]]
    skills: set[tuple[str, str, str]] = set()
    menus: set[str] = set(m for _, m in project_menus)
    for row in rows[2:]:
        if len(row) < 4 or not row[2].strip():
            continue
        for menu in norm_menus(row[2]):
            menus.add(menu)
            for j, member in enumerate(skill_members):
                v = row[3 + j].strip() if 3 + j < len(row) else ""
                if v == "メイン以上可":
                    skills.add((member, menu, "main"))
                elif v == "サブ可":
                    skills.add((member, menu, "sub"))

    # ---------- members ----------
    members = sorted({nm for _, nm, _ in assignments} | set(skill_members))

    # ---------- SQL出力 ----------
    def write_sql(fname: str, header: str, lines: list[str]) -> None:
        (SEED / fname).write_text(header + "\n" + "\n".join(lines) + "\n", encoding="utf-8")

    write_sql("01_clients.sql", "-- 顧客マスタ", [
        "insert into clients (id, name, abbreviation, status, category, industry) values\n"
        + ",\n".join(
            f"({c['id']}, {q(c['name'])}, {q(c['abbreviation'])}, {q(c['status'])}, {q(c['category'])}, {q(c['industry'])})"
            for c in clients.values()
        )
        + "\non conflict (id) do nothing;"
    ])

    write_sql("02_members.sql", "-- メンバーマスタ", [
        "insert into members (name, is_sales) values\n"
        + ",\n".join(f"({q(m)}, {lit(m == 'セールス')})" for m in members)
        + "\non conflict (name) do nothing;"
    ])

    write_sql("03_menus.sql", "-- 支援メニューマスタ", [
        "insert into menus (name) values\n"
        + ",\n".join(f"({q(m)})" for m in sorted(menus))
        + "\non conflict (name) do nothing;"
    ])

    cols = "id, client_id, client_name, status, consulting_type, amount_jpy, start_date, end_date, support_months, pm_name, sales_name, notes, contract_url"
    write_sql("04_projects.sql", "-- 案件マスタ", [
        f"insert into projects ({cols}) values\n"
        + ",\n".join(
            f"({p['id']}, {lit(p['client_id'])}, {q(p['client_name'])}, {q(p['status'])}, {q(p['consulting_type'])}, "
            f"{lit(p['amount_jpy'])}, {lit(p['start_date'])}, {lit(p['end_date'])}, {lit(p['support_months'])}, "
            f"{q(p['pm_name'])}, {q(p['sales_name'])}, {q(p['notes'])}, {q(p['contract_url'])})"
            for p in sorted(projects.values(), key=lambda x: x["id"])
        )
        + "\non conflict (id) do nothing;"
    ])

    write_sql("05_project_menus.sql", "-- 案件×メニュー", [
        "insert into project_menus (project_id, menu_id)\n"
        "select v.pid, m.id from (values\n"
        + ",\n".join(f"({pid}, {q(menu)})" for pid, menu in sorted(project_menus))
        + "\n) as v(pid, menu) join menus m on m.name = v.menu\non conflict do nothing;"
    ])

    write_sql("06_assignments.sql", "-- アサイン", [
        "insert into assignments (project_id, member_id, role)\n"
        "select v.pid, mb.id, v.role from (values\n"
        + ",\n".join(f"({pid}, {q(nm)}, {q(role)})" for pid, nm, role in sorted(assignments))
        + "\n) as v(pid, nm, role) join members mb on mb.name = v.nm\non conflict do nothing;"
    ])

    write_sql("07_skills.sql", "-- スキルマトリクス", [
        "insert into skills (member_id, menu_id, level)\n"
        "select mb.id, mn.id, v.level from (values\n"
        + ",\n".join(f"({q(nm)}, {q(menu)}, {q(level)})" for nm, menu, level in sorted(skills))
        + "\n) as v(nm, menu, level) join members mb on mb.name = v.nm join menus mn on mn.name = v.menu\non conflict do nothing;"
    ])

    print(f"clients={len(clients)} projects={len(projects)} menus={len(menus)} "
          f"members={len(members)} assignments={len(assignments)} "
          f"project_menus={len(project_menus)} skills={len(skills)}")


if __name__ == "__main__":
    sys.exit(main())
