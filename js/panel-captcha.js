// =========================================
// VERIFICACIÓN ANTI-ROBOTS AL CREAR CUENTAS DE CLIENTES (panel)
//
// Cuando Supabase tiene activada la protección CAPTCHA, toda creación de
// cuenta debe llevar un "captchaToken". Este archivo se lo agrega al signUp
// que hace panel.js, sin tener que modificar panel.js:
//   - muestra la verificación cuando empiezas a escribir la contraseña
//     (o al usar "Generar contraseña automática"),
//   - envuelve supabase.createClient para que el signUp lleve el token.
//
// Cargar DESPUÉS de captcha.js y ANTES de panel.js.
// =========================================
(function () {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return;

    const contenedor = document.getElementById('altaCaptcha');
    const campoClave = document.getElementById('altaClave');
    if (!contenedor || !campoClave) return;

    let widget = null;
    let montando = false;

    function montarVerificacion() {
        if (widget || montando) return;
        montando = true;
        contenedor.hidden = false;

        Captcha.montar('#altaCaptcha')
            .then((w) => { widget = w; })
            .catch(() => {
                contenedor.textContent = 'No se pudo cargar la verificación de seguridad. Recarga la página.';
            })
            .finally(() => { montando = false; });
    }

    campoClave.addEventListener('input', montarVerificacion);

    const botonGenerar = document.getElementById('botonGenerarClave');
    if (botonGenerar) botonGenerar.addEventListener('click', montarVerificacion);

    // Cada cliente temporal que crea panel.js para dar de alta una cuenta
    // pasa por aquí y su signUp lleva el token de verificación.
    const crearOriginal = window.supabase.createClient;

    window.supabase.createClient = function () {
        const cliente = crearOriginal.apply(window.supabase, arguments);
        const signUpOriginal = cliente.auth.signUp.bind(cliente.auth);

        cliente.auth.signUp = async function (credenciales) {
            if (!widget || !widget.token()) {
                return {
                    data: { user: null, session: null },
                    error: {
                        code: 'captcha_pendiente',
                        status: 400,
                        message: 'Espera a que termine la verificación de seguridad e inténtalo de nuevo.'
                    }
                };
            }

            const opciones = Object.assign({}, credenciales.options, { captchaToken: widget.token() });
            const respuesta = await signUpOriginal(Object.assign({}, credenciales, { options: opciones }));

            widget.reiniciar(); // cada verificación sirve una sola vez
            return respuesta;
        };

        return cliente;
    };
})();
