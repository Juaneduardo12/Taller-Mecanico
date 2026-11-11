// =========================================
// ACCESO DE CLIENTES: solo iniciar sesión
// Las cuentas las crea el administrador desde el panel.
// Requiere: supabase.js y captcha.js (cargados antes)
// =========================================
document.addEventListener('DOMContentLoaded', async () => {
    const formEntrar = document.getElementById('formEntrar');
    const entrarMensaje = document.getElementById('entrarMensaje');
    const entrarBoton = document.getElementById('entrarBoton');

    function mostrarMensaje(texto, tipo) {
        entrarMensaje.textContent = texto;
        entrarMensaje.className = 'mensaje-login ' + (tipo || '');
    }

    // Si ya hay sesión abierta, pasa directo (cliente.html decide a dónde mandarlo según su rol)
    try {
        const { data } = await db.auth.getSession();
        if (data.session) {
            window.location.replace('cliente.html');
            return;
        }
    } catch (e) {
        // si falla, se muestra el formulario normal
    }

    // Aviso cuando guard.js lo regresó por no tener rol asignado
    if (new URLSearchParams(window.location.search).get('motivo') === 'sinrol') {
        mostrarMensaje('Tu cuenta aún no tiene un rol asignado. Contacta al taller.', 'error');
    }

    // ---------- Verificación anti-robots (Cloudflare Turnstile) ----------
    let captcha = null;
    let captchaFallo = false;

    Captcha.montar('#captchaCliente')
        .then((widget) => { captcha = widget; })
        .catch(() => {
            captchaFallo = true;
            mostrarMensaje('No se pudo cargar la verificación de seguridad. Recarga la página o revisa tu conexión.', 'error');
        });

    formEntrar.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        mostrarMensaje('');

        const correo = document.getElementById('entrarCorreo').value.trim();
        const clave = document.getElementById('entrarClave').value;

        if (!correo || !clave) {
            mostrarMensaje('Escribe tu correo y tu contraseña.', 'error');
            return;
        }

        if (!captcha || !captcha.token()) {
            mostrarMensaje(
                captchaFallo
                    ? 'No se pudo cargar la verificación de seguridad. Recarga la página.'
                    : 'Espera a que termine la verificación de seguridad.',
                'error'
            );
            return;
        }

        entrarBoton.disabled = true;
        entrarBoton.textContent = 'Entrando...';

        try {
            const { error } = await db.auth.signInWithPassword({
                email: correo,
                password: clave,
                options: { captchaToken: captcha.token() }
            });

            if (!error) {
                window.location.replace('cliente.html');
                return;
            }

            if (error.code === 'captcha_failed') {
                mostrarMensaje('Falló la verificación de seguridad. Inténtalo de nuevo.', 'error');
            } else if (error.code === 'email_not_confirmed') {
                mostrarMensaje('Primero confirma tu correo con el enlace que te enviamos.', 'error');
            } else if (error.status === 429) {
                mostrarMensaje('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 'error');
            } else if (error.status === 400) {
                mostrarMensaje('Correo o contraseña incorrectos.', 'error');
            } else {
                mostrarMensaje('No pudimos iniciar sesión. Inténtalo más tarde.', 'error');
            }
        } catch (e) {
            mostrarMensaje('Error de conexión. Revisa tu internet.', 'error');
        } finally {
            entrarBoton.disabled = false;
            entrarBoton.textContent = 'Entrar';
            captcha.reiniciar();
        }
    });
});
