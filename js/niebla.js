// =========================================
// NIEBLA DEL LOGOTIPO
// Al bajar con el scroll la niebla se va aclarando;
// al subir de nuevo, vuelve a cubrir el logotipo.
// (Los estilos están en css/efectos.css)
// =========================================
(function () {
    const niebla = document.querySelector('.difuminado-ancho');
    const seccion = document.querySelector('.imagen-taller-pc');
    if (!niebla || !seccion) return;

    let pendiente = false;

    function actualizar() {
        pendiente = false;

        // Distancia de scroll en la que la niebla desaparece por completo
        const distancia = Math.max(220, seccion.offsetHeight * 0.9);
        const progreso = Math.min(Math.max(window.scrollY / distancia, 0), 1);

        // Curva suave: aclara despacio al inicio y al final
        const suave = progreso * progreso * (3 - 2 * progreso);

        niebla.style.setProperty('--niebla', (1 - suave).toFixed(3));
    }

    window.addEventListener('scroll', () => {
        if (!pendiente) {
            pendiente = true;
            window.requestAnimationFrame(actualizar);
        }
    }, { passive: true });

    window.addEventListener('resize', actualizar);
    actualizar();
})();
