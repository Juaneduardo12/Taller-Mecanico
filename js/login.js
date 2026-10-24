// =========================================
// LOGIN CON SUPABASE
// =========================================

// Cámbialo a true cuando termines de configurar Cloudflare Turnstile
// (ver instrucciones al final de login.html)
const TURNSTILE_ACTIVO = false;

// Página a la que se va después de iniciar sesión
const PAGINA_DESTINO = 'panel.html';

document.addEventListener('DOMContentLoaded', async () => {
    const formulario = document.getElementById('formLogin');
    const mensaje = document.getElementById('mensajeLogin');
    const boton = document.getElementById('botonEntrar');
    const campoContrasena = document.getElementById('contrasena');
    const botonVer = document.getElementById('botonVerContrasena');

    if (!formulario) return;

    // Si ya tiene sesión abierta, pasa directo
    try {
        const { data } = await db.auth.getSession();
        if (data.session) {
            window.location.href = PAGINA_DESTINO;
            return;
        }
    } catch (e) {
        // si falla, se muestra el formulario normal
    }

    // Mostrar / ocultar contraseña
    botonVer.addEventListener('click', () => {
        const visible = campoContrasena.type === 'text';
        campoContrasena.type = visible ? 'password' : 'text';
        botonVer.textContent = visible ? 'Mostrar' : 'Ocultar';
        botonVer.setAttribute('aria-pressed', String(!visible));
    });

    function mostrarMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = 'mensaje-login ' + (tipo || '');
    }

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        mostrarMensaje('');

        const datos = new FormData(formulario);
        const correo = (datos.get('correo') || '').trim();
        const contrasena = datos.get('contrasena') || '';
        const captchaToken = datos.get('cf-turnstile-response') || '';

        if (!correo || !contrasena) {
            mostrarMensaje('Escribe tu correo y tu contraseña.', 'error');
            return;
        }

        if (TURNSTILE_ACTIVO && !captchaToken) {
            mostrarMensaje('Espera a que termine la verificación de seguridad.', 'error');
            return;
        }

        boton.disabled = true;
        boton.textContent = 'Entrando...';

        try {
            const credenciales = { email: correo, password: contrasena };
            if (TURNSTILE_ACTIVO) {
                credenciales.options = { captchaToken };
            }

            const { error } = await db.auth.signInWithPassword(credenciales);

            if (!error) {
                window.location.href = PAGINA_DESTINO;
                return;
            }

            if (error.code === 'captcha_failed') {
                mostrarMensaje('Falló la verificación de seguridad. Inténtalo de nuevo.', 'error');
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
            boton.disabled = false;
            boton.textContent = 'Entrar';
            // El token de Turnstile solo sirve una vez
            if (TURNSTILE_ACTIVO && window.turnstile) window.turnstile.reset();
        }
    });
});
