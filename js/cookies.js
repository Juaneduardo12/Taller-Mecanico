// =========================================
// AVISO DE COOKIES (informativo)
//
// El sitio solo usa almacenamiento técnico necesario (mantener la sesión,
// la verificación de seguridad y recordar que ya viste este aviso).
// No hay cookies de publicidad ni de seguimiento, por eso el aviso es
// informativo. Si algún día agregas analítica o publicidad, aquí habría
// que agregar botones de Aceptar / Rechazar para esas categorías.
//
// Se usa en las páginas públicas junto con css/seguridad.css
// =========================================
(function () {
    const CLAVE = 'omega_aviso_cookies';
    const VERSION = '1'; // si cambias el texto del aviso, cambia este número para mostrarlo otra vez

    try {
        if (window.localStorage.getItem(CLAVE) === VERSION) return;
    } catch (e) {
        // si el navegador bloquea el almacenamiento, el aviso se muestra siempre
    }

    function crear() {
        const caja = document.createElement('aside');
        caja.className = 'aviso-cookies';
        caja.setAttribute('role', 'dialog');
        caja.setAttribute('aria-label', 'Aviso de cookies');

        const texto = document.createElement('p');
        texto.className = 'aviso-cookies-texto';
        texto.append(
            'Este sitio usa solo almacenamiento técnico necesario para funcionar: mantener tu sesión ' +
            'iniciada y una verificación de seguridad contra robots. No usamos cookies de publicidad ni de ' +
            'seguimiento. '
        );

        const enlace = document.createElement('a');
        enlace.href = 'aviso-privacidad.html#cookies';
        enlace.textContent = 'Más información';
        texto.appendChild(enlace);

        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'aviso-cookies-boton';
        boton.textContent = 'Entendido';
        boton.addEventListener('click', () => {
            try {
                window.localStorage.setItem(CLAVE, VERSION);
            } catch (e) {
                // sin almacenamiento: solo se cierra por esta visita
            }
            caja.remove();
        });

        caja.append(texto, boton);
        document.body.appendChild(caja);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', crear);
    } else {
        crear();
    }
})();
