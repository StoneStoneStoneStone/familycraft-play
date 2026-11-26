// FamilyCraft online settings.
// Leave both empty to play on one device or over home Wi-Fi (node serve.mjs).
// To play over the internet through your own Supabase project, fill both in:
//   Supabase dashboard -> Project Settings -> API -> "Project URL" and the "anon" / "publishable" key.
//   Never put the service_role / secret key here: this file is public to every player.
window.FC_CONFIG = window.FC_CONFIG || {
  supabaseUrl: "",
  supabaseAnonKey: ""
};
