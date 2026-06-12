export interface Member {
  id: number;
  name: string;
  is_sales: boolean;
  is_active: boolean;
}

export interface Project {
  id: number;
  client_id: number | null;
  client_name: string;
  status: string;
  consulting_type: string | null;
  amount_jpy: number | null;
  start_date: string | null;
  end_date: string | null;
  support_months: number | null;
  pm_name: string | null;
  sales_name: string | null;
  notes: string | null;
  contract_url: string | null;
}

export interface Assignment {
  id: number;
  project_id: number;
  member_id: number;
  role: string;
}

export interface ProjectMenu {
  project_id: number;
  menu_id: number;
}

export interface Menu {
  id: number;
  name: string;
}

export interface Skill {
  member_id: number;
  menu_id: number;
  level: "main" | "sub";
}
