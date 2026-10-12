// Capa de datos: usa Supabase si está configurado; si no, guarda en localStorage (modo demo).
const DB = (() => {
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = window.USUARIOS_CONFIG;
  const live = Boolean(url && key && !url.includes("TU-PROYECTO"));
  const sb = live && window.supabase ? window.supabase.createClient(url, key) : null;
  const COLS = "id,nombre,direccion,telefono,correo,cargo,usuario"; // nunca se pide la clave
  const leer = () => JSON.parse(localStorage.getItem("usuario_tabla") || "[]");
  const guardar = r => localStorage.setItem("usuario_tabla", JSON.stringify(r));
  const sinClave = ({ clave_acceso, ...resto }) => resto;
  const duplicado = () => new Error("Ese nombre de usuario ya existe. Elige otro.");
  const check = ({ data, error }) => {
    if (error) throw error.code === "23505" ? duplicado() : error;
    return data;
  };

  return {
    live,
    async login(email, password) {
      if (!live) { localStorage.setItem("usuario_sesion", "1"); return; }
      if (!sb) throw new Error("No se cargó la librería de Supabase. Revisa tu internet o desactiva el bloqueador de anuncios.");
      check(await sb.auth.signInWithPassword({ email, password }));
    },
    async logout() { live ? await sb.auth.signOut() : localStorage.removeItem("usuario_sesion"); },
    async haySesion() {
      if (!live) return Boolean(localStorage.getItem("usuario_sesion"));
      return sb ? Boolean((await sb.auth.getSession()).data.session) : false;
    },
    async list() {
      if (!live) return leer().map(sinClave).sort((a, b) => b.id - a.id);
      return check(await sb.from("usuario").select(COLS).order("id", { ascending: false }));
    },
    async insert(row) {
      if (!live) {
        if (leer().some(u => u.usuario === row.usuario)) throw duplicado();
        guardar([...leer(), { ...row, id: Date.now() }]); return;
      }
      check(await sb.from("usuario").insert(row));
    },
    async update(id, row) {
      if (!live) {
        if (leer().some(u => u.id != id && u.usuario === row.usuario)) throw duplicado();
        guardar(leer().map(u => u.id == id ? { ...u, ...row } : u)); return;
      }
      check(await sb.from("usuario").update(row).eq("id", id));
    },
    async remove(id) {
      if (!live) { guardar(leer().filter(u => u.id != id)); return; }
      check(await sb.from("usuario").delete().eq("id", id));
    }
  };
})();