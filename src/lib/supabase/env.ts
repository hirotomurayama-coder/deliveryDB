// Supabase接続情報。
// URLとpublishableキーはクライアントバンドルに埋め込まれる前提の公開値のため、
// 環境変数が未設定の場合はフォールバックとして直接指定する（セキュリティはRLSで担保）。
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://xwseshbuzffllqmjpqmj.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_d9O-tjbdYJR-rckwQhag9w_UYr-GpgH";
