// =========================================
// TÍTULOS DE LAS TABLAS PARA CELULAR
//
// En celular cada fila se muestra como una tarjeta (css/tablas.css) y cada dato
// necesita su título ("Cliente", "Servicio"...). Este archivo copia automáticamente
// el título de cada columna a cada celda, y se actualiza solo cuando una tabla se
// vuelve a llenar. Así funciona con cualquier tabla del panel sin tocar su código.
//
// Cargar al final, después de los demás scripts del panel.
// =========================================
(function () {
    function etiquetar(tabla) {
        const titulos = Array.from(tabla.querySelectorAll('thead th')).map((th) => th.textContent.trim());

        tabla.querySelectorAll('tbody tr').forEach((fila) => {
            Array.from(fila.children).forEach((celda, i) => {
                const titulo = titulos[i];
                if (titulo && celda.getAttribute('data-label') !== titulo) {
                    celda.setAttribute('data-label', titulo);
                }
            });
        });
    }

    function vigilar(tabla) {
        etiquetar(tabla);

        // Cada vez que se agregan o reemplazan filas (se carga la tabla de nuevo)
        const cuerpo = tabla.querySelector('tbody');
        if (cuerpo) {
            new MutationObserver(() => etiquetar(tabla)).observe(cuerpo, { childList: true });
        }

        // Por si los títulos de columna se generan después (Proveedores y Clientes)
        const cabecera = tabla.querySelector('thead');
        if (cabecera) {
            new MutationObserver(() => etiquetar(tabla)).observe(cabecera, { childList: true, subtree: true });
        }
    }

    document.querySelectorAll('.tabla').forEach(vigilar);
})();
