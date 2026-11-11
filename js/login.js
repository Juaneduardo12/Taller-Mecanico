// =========================================
// LOGIN (personal y clientes en la misma pantalla)
// Requiere: supabase.js y captcha.js (cargados antes)
//
// Después de iniciar sesión, cada rol va a su página:
//   admin / empleado -> panel.html      cliente -> cliente.html
// =========================================
document.addEventListener('DOMContentLoaded', async () => {
    const formulario = document.getElementById('formLogin');
    const mensaje = document.getElementById('mensajeLogin');
    const boton = document.getElementById('botonEntrar');
    const campoClave = document.getElementById('contrasena');
    const botonVer = document.getElementById('togglePassword');

    if (!formulario) return;

    function mostrarMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = 'mensaje-login ' + (tipo || '');
    }

    // ---------- A dónde va cada rol ----------
    async function irSegunRol(idUsuario) {
        let destino = 'panel.html';
        try {
            const { data } = await db.from('perfiles').select('rol').eq('id', idUsuario).maybeSingle();
            if (data && data.rol === 'cliente') destino = 'cliente.html';
        } catch (e) {
            // si falla, panel.html valida el rol y redirige donde corresponda
        }
        window.location.replace(destino);
    }

    // ---------- Si ya hay una sesión abierta, pasa directo ----------
    try {
        const { data } = await db.auth.getSession();
        if (data.session) {
            await irSegunRol(data.session.user.id);
            return;
        }
    } catch (e) {
        // si falla, se muestra el formulario normal
    }

    // Aviso cuando otra página lo regresó por no tener rol asignado
    if (new URLSearchParams(window.location.search).get('motivo') === 'sinrol') {
        mostrarMensaje('Tu cuenta aún no tiene un rol asignado. Contacta al administrador del taller.', 'error');
    }

    // ---------- Mostrar / ocultar contraseña ----------
    if (botonVer) {
        botonVer.addEventListener('click', () => {
            const visible = campoClave.type === 'text';
            campoClave.type = visible ? 'password' : 'text';
            botonVer.textContent = visible ? 'Mostrar' : 'Ocultar';
        });
    }

    // ---------- Verificación anti-robots (Cloudflare Turnstile) ----------
    let captcha = null;
    let captchaFallo = false;

    Captcha.montar('#captchaLogin')
        .then((widget) => { captcha = widget; })
        .catch(() => {
            captchaFallo = true;
            mostrarMensaje('No se pudo cargar la verificación de seguridad. Recarga la página o revisa tu conexión.', 'error');
        });

    // ---------- Enviar ----------
    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        mostrarMensaje('');

        const correo = document.getElementById('correo').value.trim();
        const clave = campoClave.value;

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

        boton.disabled = true;
        boton.textContent = 'Entrando...';

        try {
            const { data, error } = await db.auth.signInWithPassword({
                email: correo,
                password: clave,
                options: { captchaToken: captcha.token() }
            });

            if (!error) {
                await irSegunRol(data.user.id);
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
            boton.disabled = false;
            boton.textContent = 'Entrar';
            // Cada verificación sirve una sola vez: se pide otra
            captcha.reiniciar();
        }
    });
});
