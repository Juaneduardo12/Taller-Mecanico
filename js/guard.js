// =========================================
// PROTECCIÓN DE PÁGINAS PRIVADAS (sesión + rol)
// Cargar DESPUÉS de supabase.js.
//
// En cada página privada, el <body> indica quién puede entrar:
//   <body data-roles="admin,empleado" data-login="login.html">
//
// Deja disponible window.sesionLista, una promesa que entrega
// { id, email, nombre, rol } cuando todo está validado
// (o null si se redirigió a otra página).
// =========================================

// Oculta la página hasta confirmar sesión y rol
document.documentElement.style.visibility = 'hidden';

const URL_LOGIN = document.body.dataset.login || 'login.html';

window.sesionLista = (async () => {
    try {
        const { data } = await db.auth.getSession();
        const sesion = data.session;

        if (!sesion) {
            window.location.replace(URL_LOGIN);
            return null;
        }

        // Rol del usuario (cada quien solo puede leer su propio perfil)
        const { data: perfil, error } = await db
            .from('perfiles')
            .select('nombre, rol')
            .eq('id', sesion.user.id)
            .maybeSingle();

        if (error || !perfil) {
            await db.auth.signOut();
            window.location.replace(URL_LOGIN + (URL_LOGIN.includes('?') ? '&' : '?') + 'motivo=sinrol');
            return null;
        }

        const permitidos = (document.body.dataset.roles || '')
            .split(',')
            .map((rol) => rol.trim())
            .filter(Boolean);

        if (permitidos.length && !permitidos.includes(perfil.rol)) {
            // Cada rol tiene su propia casa
            window.location.replace(perfil.rol === 'cliente' ? 'cliente.html' : 'panel.html');
            return null;
        }

        document.documentElement.style.visibility = 'visible';
        return {
            id: sesion.user.id,
            email: sesion.user.email,
            nombre: perfil.nombre,
            rol: perfil.rol
        };
    } catch (e) {
        window.location.replace(URL_LOGIN);
        return null;
    }
})();

// Si cierra sesión en otra pestaña, lo saca de aquí también
db.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') {
        window.location.replace(URL_LOGIN);
    }
});

async function cerrarSesion() {
    await db.auth.signOut();
    window.location.replace(URL_LOGIN);
}
