// =========================================
// PROTECCIÓN DE PÁGINAS PRIVADAS
// Debe cargarse DESPUÉS de supabase.js
// =========================================

// Oculta la página hasta confirmar que hay sesión (evita ver contenido un instante)
document.documentElement.style.visibility = 'hidden';

(async () => {
    try {
        const { data } = await db.auth.getSession();

        if (!data.session) {
            window.location.replace('login.html');
            return;
        }

        // Muestra el correo del usuario si existe un elemento con id="correoUsuario"
        const etiqueta = document.getElementById('correoUsuario');
        if (etiqueta) etiqueta.textContent = data.session.user.email;

        document.documentElement.style.visibility = 'visible';
    } catch (e) {
        window.location.replace('login.html');
    }
})();

// Si cierra sesión en otra pestaña, lo saca de aquí también
db.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') {
        window.location.replace('login.html');
    }
});

async function cerrarSesion() {
    await db.auth.signOut();
    window.location.replace('login.html');
}
