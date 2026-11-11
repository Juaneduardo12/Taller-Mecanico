// =========================================
// BOTÓN "X" DEL MENÚ DE CELULAR (panel)
//
// La X no maneja el menú por su cuenta: usa el mismo botón de la hamburguesa
// que ya controla panel.js, así todo queda sincronizado.
// Cargar después de panel.js.
// =========================================
(function () {
    const botonX = document.getElementById('menuCerrar');
    const hamburguesa = document.getElementById('botonMenu');
    if (!botonX || !hamburguesa) return;

    function cerrar() {
        if (document.body.classList.contains('menu-abierto')) {
            hamburguesa.click();
        }
    }

    botonX.addEventListener('click', cerrar);

    // También se cierra con la tecla Escape (solo en celular, donde el menú es una tarjeta)
    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape' && window.matchMedia('(max-width: 767px)').matches) {
            cerrar();
        }
    });
})();
