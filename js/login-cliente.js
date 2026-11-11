// =========================================
// LOGIN UNIFICADO: pestañas Personal / Cliente
// y acceso de clientes (iniciar sesión y crear cuenta).
// El acceso del personal sigue en js/login.js
// =========================================

// Versión del aviso de privacidad que se acepta al registrarse.
// Si cambias el contenido de aviso-privacidad.html, cambia también esta fecha.
const AVISO_VERSION = '2026-10-28';

document.addEventListener('DOMContentLoaded', () => {
    const tabPersonal = document.getElementById('tabPersonal');
    const tabCliente = document.getElementById('tabCliente');
    const formLogin = document.getElementById('formLogin');
    const zonaCliente = document.getElementById('zonaCliente');
    const subtitulo = document.getElementById('subtituloLogin');

    const pestanaEntrar = document.getElementById('pestanaEntrar');
    const pestanaRegistro = document.getElementById('pestanaRegistro');
    const formEntrar = document.getElementById('formEntrar');
    const formRegistro = document.getElementById('formRegistro');

    function mostrarMensaje(elemento, texto, tipo) {
        elemento.textContent = texto;
        elemento.className = 'mensaje-login ' + (tipo || '');
    }

    // ---------- Personal / Cliente ----------
    function mostrarTipo(esCliente) {
        formLogin.hidden = esCliente;
        zonaCliente.hidden = !esCliente;
        tabPersonal.classList.toggle('activa', !esCliente);
        tabCliente.classList.toggle('activa', esCliente);
        tabPersonal.setAttribute('aria-selected', String(!esCliente));
        tabCliente.setAttribute('aria-selected', String(esCliente));
        subtitulo.textContent = esCliente
            ? 'Entra a tu cuenta de cliente o crea una nueva'
            : 'Acceso exclusivo para el personal de OMEGA MECHANIC';
    }

    tabPersonal.addEventListener('click', () => mostrarTipo(false));
    tabCliente.addEventListener('click', () => mostrarTipo(true));

    // ---------- Entrar / Crear cuenta ----------
    function mostrarSubpestana(registro) {
        formEntrar.hidden = registro;
        formRegistro.hidden = !registro;
        pestanaEntrar.classList.toggle('activa', !registro);
        pestanaRegistro.classList.toggle('activa', registro);
        pestanaEntrar.setAttribute('aria-selected', String(!registro));
        pestanaRegistro.setAttribute('aria-selected', String(registro));
    }

    pestanaEntrar.addEventListener('click', () => mostrarSubpestana(false));
    pestanaRegistro.addEventListener('click', () => mostrarSubpestana(true));

    // ---------- Abrir directo la pestaña Cliente (cuando un cliente cierra sesión) ----------
    const parametros = new URLSearchParams(window.location.search);
    if (parametros.get('tipo') === 'cliente') {
        mostrarTipo(true);
        if (parametros.get('motivo') === 'sinrol') {
            mostrarMensaje(
                document.getElementById('entrarMensaje'),
                'Tu cuenta aún no tiene un rol asignado. Contacta al taller.',
                'error'
            );
        }
    }

    // ---------- Iniciar sesión como cliente ----------
    const entrarMensaje = document.getElementById('entrarMensaje');
    const entrarBoton = document.getElementById('entrarBoton');

    formEntrar.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        mostrarMensaje(entrarMensaje, '');

        const correo = document.getElementById('entrarCorreo').value.trim();
        const clave = document.getElementById('entrarClave').value;

        if (!correo || !clave) {
            mostrarMensaje(entrarMensaje, 'Escribe tu correo y tu contraseña.', 'error');
            return;
        }

        entrarBoton.disabled = true;
        entrarBoton.textContent = 'Entrando...';

        try {
            const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });

            if (!error) {
                window.location.replace('cliente.html');
                return;
            }

            if (error.code === 'email_not_confirmed') {
                mostrarMensaje(entrarMensaje, 'Primero confirma tu correo con el enlace que te enviamos.', 'error');
            } else if (error.status === 429) {
                mostrarMensaje(entrarMensaje, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 'error');
            } else if (error.status === 400) {
                mostrarMensaje(entrarMensaje, 'Correo o contraseña incorrectos.', 'error');
            } else {
                mostrarMensaje(entrarMensaje, 'No pudimos iniciar sesión. Inténtalo más tarde.', 'error');
            }
        } catch (e) {
            mostrarMensaje(entrarMensaje, 'Error de conexión. Revisa tu internet.', 'error');
        } finally {
            entrarBoton.disabled = false;
            entrarBoton.textContent = 'Entrar';
        }
    });

    // ---------- Crear cuenta (alta de cliente) ----------
    const regMensaje = document.getElementById('regMensaje');
    const regBoton = document.getElementById('regBoton');

    formRegistro.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        mostrarMensaje(regMensaje, '');

        const nombre = document.getElementById('regNombre').value.trim();
        const apellidos = document.getElementById('regApellidos').value.trim();
        const telefono = document.getElementById('regTelefono').value.trim();
        const correo = document.getElementById('regCorreo').value.trim();
        const clave = document.getElementById('regClave').value;
        const clave2 = document.getElementById('regClave2').value;

        if (!nombre || !correo) {
            mostrarMensaje(regMensaje, 'Escribe tu nombre y tu correo.', 'error');
            return;
        }
        if (clave.length < 8) {
            mostrarMensaje(regMensaje, 'La contraseña debe tener al menos 8 caracteres.', 'error');
            return;
        }
        if (clave !== clave2) {
            mostrarMensaje(regMensaje, 'Las contraseñas no coinciden.', 'error');
            return;
        }
        if (!document.getElementById('regAviso').checked) {
            mostrarMensaje(regMensaje, 'Para crear tu cuenta debes aceptar el Aviso de Privacidad.', 'error');
            return;
        }

        regBoton.disabled = true;
        regBoton.textContent = 'Creando cuenta...';

        try {
            const { data, error } = await db.auth.signUp({
                email: correo,
                password: clave,
                options: {
                    // "registro: cliente" le dice a la base que cree su perfil de cliente
                    data: {
                        registro: 'cliente',
                        nombre: nombre,
                        apellidos: apellidos,
                        telefono: telefono,
                        acepto_aviso: true,
                        version_aviso: AVISO_VERSION
                    }
                }
            });

            if (error) {
                if (error.code === 'user_already_exists') {
                    mostrarMensaje(regMensaje, 'Ese correo ya está registrado. Inicia sesión.', 'error');
                } else if (error.code === 'signup_disabled') {
                    mostrarMensaje(regMensaje, 'El registro de clientes no está disponible por ahora.', 'error');
                } else if (error.code === 'weak_password') {
                    mostrarMensaje(regMensaje, 'La contraseña es muy débil. Usa una más larga o con más variedad.', 'error');
                } else if (error.status === 429) {
                    mostrarMensaje(regMensaje, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 'error');
                } else {
                    mostrarMensaje(regMensaje, 'No pudimos crear tu cuenta. Inténtalo más tarde.', 'error');
                }
                return;
            }

            if (data.session) {
                // Con la confirmación de correo apagada, entra directo
                window.location.replace('cliente.html');
            } else {
                mostrarMensaje(regMensaje, 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.', 'ok');
                formRegistro.reset();
            }
        } catch (e) {
            mostrarMensaje(regMensaje, 'Error de conexión. Revisa tu internet.', 'error');
        } finally {
            regBoton.disabled = false;
            regBoton.textContent = 'Crear cuenta';
        }
    });
});
