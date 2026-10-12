const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let lista = [];
let editandoId = null;

function toast(msg, error) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast ver" + (error ? " error" : "");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.className = "toast", 3500);
}

// La clave nunca se guarda en texto plano: se guarda "sal:hash" (PBKDF2-SHA256)
async function hashClave(clave) {
  if (!window.crypto?.subtle) throw new Error("Este navegador no permite cifrar la clave. Usa Chrome o Edge actualizado.");
  const enc = new TextEncoder(), sal = crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: 100000 }, base, 256);
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  return hex(sal) + ":" + hex(bits);
}

// ---- Lista y búsqueda ----
function pintar() {
  const q = $("#buscar").value.trim().toLowerCase();
  const filas = lista.filter(u => [u.nombre, u.usuario, u.correo, u.cargo, u.telefono].some(v => String(v || "").toLowerCase().includes(q)));
  $("#tabla").innerHTML = filas.map(u => `<tr>
      <td>${esc(u.nombre)}</td><td>${esc(u.direccion)}</td><td>${esc(u.telefono)}</td><td>${esc(u.correo)}</td><td>${esc(u.cargo)}</td><td>${esc(u.usuario)}</td>
      <td class="acc"><button class="link" data-edit="${u.id}">Editar</button><button class="link peligro" data-del="${u.id}">Eliminar</button></td></tr>`).join("")
    || `<tr><td class="vacio" colspan="7">${lista.length ? "Ningún usuario coincide con la búsqueda." : "Aún no hay usuarios. Registra el primero con el formulario."}</td></tr>`;
  $("#contador").textContent = `${filas.length} de ${lista.length}`;
}

async function cargar() {
  try { lista = await DB.list(); $("#aviso").hidden = true; }
  catch (err) {
    console.error(err);
    $("#aviso").textContent = "No se pudieron cargar los usuarios: " + (err.message || err) + ". Revisa que ejecutaste database/usuarios.sql en Supabase.";
    $("#aviso").hidden = false;
  }
  pintar();
}

// ---- Formulario: registrar / actualizar ----
function modoNuevo() {
  editandoId = null;
  $("#form-usuario").reset();
  $("#titulo-form").textContent = "Nuevo usuario";
  $("#guardar").textContent = "Registrar";
  $("#cancelar").hidden = true;
  $("#clave").required = true; $("#clave").placeholder = "";
}

function modoEditar(id) {
  const u = lista.find(x => x.id == id);
  editandoId = u.id;
  const f = $("#form-usuario");
  ["nombre", "direccion", "telefono", "correo", "cargo", "usuario"].forEach(k => f.elements[k].value = u[k] ?? "");
  f.elements.clave.value = "";
  $("#titulo-form").textContent = "Actualizar usuario";
  $("#guardar").textContent = "Actualizar";
  $("#cancelar").hidden = false;
  $("#clave").required = false; $("#clave").placeholder = "Vacía = no cambiar";
  f.elements.nombre.focus();
}

$("#form-usuario").onsubmit = async e => {
  e.preventDefault();
  const f = e.target, btn = $("#guardar");
  const d = Object.fromEntries(new FormData(f));
  const datos = { nombre: d.nombre.trim(), direccion: d.direccion.trim(), telefono: d.telefono.trim(), correo: d.correo.trim(), cargo: d.cargo.trim(), usuario: d.usuario.trim() };
  btn.disabled = true;
  try {
    if (d.clave) datos.clave_acceso = await hashClave(d.clave);
    if (editandoId) await DB.update(editandoId, datos); else await DB.insert(datos);
    toast(editandoId ? "Usuario actualizado" : "Usuario registrado");
    modoNuevo(); await cargar();
  } catch (err) { toast(err.message || String(err), true); }
  finally { btn.disabled = false; }
};
$("#cancelar").onclick = modoNuevo;
$("#buscar").oninput = pintar;

// ---- Editar / eliminar desde la tabla ----
$("#tabla").addEventListener("click", async e => {
  const { edit, del } = e.target.dataset;
  if (edit) modoEditar(edit);
  if (del) {
    const u = lista.find(x => x.id == del);
    if (!confirm(`¿Eliminar al usuario "${u.usuario}"? No se puede deshacer.`)) return;
    try { await DB.remove(del); if (editandoId == del) modoNuevo(); toast("Usuario eliminado"); await cargar(); }
    catch (err) { toast(err.message || String(err), true); }
  }
});

// ---- Sesión ----
async function entrar() { $("#login").hidden = true; $("#app").hidden = false; modoNuevo(); await cargar(); }
$("#form-login").onsubmit = async e => {
  e.preventDefault();
  const msg = $("#error-login"), btn = e.target.querySelector("button");
  msg.hidden = true; btn.disabled = true; btn.textContent = "Entrando…";
  const d = Object.fromEntries(new FormData(e.target));
  try { await DB.login(d.email.trim(), d.password); await entrar(); }
  catch (err) { console.error(err); msg.textContent = "No se pudo iniciar sesión: " + (err.message || err); msg.hidden = false; }
  finally { btn.disabled = false; btn.textContent = "Iniciar sesión"; }
};
$("#salir").onclick = async () => { await DB.logout(); location.reload(); };

$("#aviso-demo").hidden = DB.live;
DB.haySesion().then(ok => ok && entrar());