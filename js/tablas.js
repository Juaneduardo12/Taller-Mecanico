// =========================================
// TABLAS DEL PANEL: ORDENAR, BUSCAR Y VISTA DE TARJETAS EN CELULAR
//
// Funciona con cualquier tabla con la clase "tabla" sin tocar el código que la llena:
//   - Ordenar: clic en el título de una columna (flechas ▲▼). Ordena alfabéticamente en
//     español (ignora acentos y mayúsculas), y los números y las fechas por su valor real.
//   - Buscar: cuadro de búsqueda arriba de cada tabla.
//   - Celular: copia el título de cada columna a sus celdas (para las tarjetas)
//     y agrega un selector "Ordenar por".
//
// Si una celda tiene el atributo data-orden, ese valor se usa para ordenar
// (por ejemplo, la fecha completa en lugar del texto "mié, 11 nov 2026").
//
// Cargar al final, después de los demás scripts del panel.
// =========================================
(function () {
    'use strict';

    const REGEX_NUMERO = /^\$?-?\d[\d,]*(\.\d+)?$/;

    const quitarAcentos = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const esVacio = (texto) => texto === '' || texto === '—' || texto === '-';
    const esNumero = (texto) => REGEX_NUMERO.test(texto);
    const aNumero = (texto) => parseFloat(texto.replace(/[$,]/g, ''));

    function comparar(a, b) {
        if (esNumero(a) && esNumero(b)) return aNumero(a) - aNumero(b);
        return a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });
    }

    function valorOrden(celda) {
        if (!celda) return '';
        const valor = celda.getAttribute('data-orden');
        return (valor !== null ? valor : celda.textContent).trim();
    }

    function iniciar(tabla) {
        const cuerpo = tabla.querySelector('tbody');
        const cabecera = tabla.querySelector('thead');
        const contenedor = tabla.closest('.tabla-contenedor');
        if (!cuerpo || !cabecera || !contenedor || !contenedor.parentNode) return;

        const estado = { columna: -1, direccion: 1, busqueda: '' };
        let ocupado = false; // evita que nuestros propios cambios disparen el observador

        // ---------- Barra de herramientas: buscador + ordenar (celular) ----------
        const herramientas = document.createElement('div');
        herramientas.className = 'tabla-herramientas';

        const buscador = document.createElement('input');
        buscador.type = 'search';
        buscador.className = 'tabla-buscador';
        buscador.placeholder = 'Buscar en la tabla...';
        buscador.setAttribute('aria-label', 'Buscar en la tabla');

        const ordenMovil = document.createElement('div');
        ordenMovil.className = 'orden-movil';
        const selector = document.createElement('select');
        selector.setAttribute('aria-label', 'Ordenar por');
        const botonDireccion = document.createElement('button');
        botonDireccion.type = 'button';
        botonDireccion.className = 'orden-direccion';
        botonDireccion.setAttribute('aria-label', 'Cambiar el sentido del orden');
        ordenMovil.append(selector, botonDireccion);

        herramientas.append(buscador, ordenMovil);
        contenedor.parentNode.insertBefore(herramientas, contenedor);

        const sinResultados = document.createElement('p');
        sinResultados.className = 'estado-tabla sin-resultados';
        sinResultados.textContent = 'No hay resultados para tu búsqueda.';
        sinResultados.hidden = true;
        contenedor.parentNode.insertBefore(sinResultados, contenedor.nextSibling);

        // ---------- Títulos de columna ----------
        const titulos = () => Array.from(cabecera.querySelectorAll('th'));
        const esOrdenable = (th) => !/^acciones$/i.test(th.textContent.trim());

        function prepararCabecera() {
            const ths = titulos();

            ths.forEach((th) => {
                if (!esOrdenable(th) || th.dataset.ordenable === '1') return;
                th.dataset.ordenable = '1';
                th.classList.add('ordenable');
                th.tabIndex = 0;
                th.setAttribute('aria-sort', 'none');
                th.title = 'Ordenar por esta columna';
                th.addEventListener('click', () => ordenarPor(titulos().indexOf(th)));
                th.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        ordenarPor(titulos().indexOf(th));
                    }
                });
            });

            // Selector de celular
            selector.replaceChildren();
            const sin = document.createElement('option');
            sin.value = '-1';
            sin.textContent = 'Ordenar por...';
            selector.appendChild(sin);
            ths.forEach((th, i) => {
                if (!esOrdenable(th)) return;
                const o = document.createElement('option');
                o.value = String(i);
                o.textContent = th.textContent.trim();
                selector.appendChild(o);
            });
            selector.value = String(estado.columna);
        }

        function actualizarControles() {
            titulos().forEach((th, i) => {
                if (!th.dataset.ordenable) return;
                const activa = i === estado.columna;
                th.setAttribute('aria-sort', activa ? (estado.direccion === 1 ? 'ascending' : 'descending') : 'none');
            });
            selector.value = String(estado.columna);
            botonDireccion.textContent = estado.direccion === 1 ? '▲' : '▼';
            botonDireccion.disabled = estado.columna < 0;
        }

        // ---------- Títulos en cada dato (tarjetas de celular) y columnas numéricas ----------
        function etiquetar() {
            const nombres = titulos().map((th) => th.textContent.trim());
            const filas = Array.from(cuerpo.rows);

            filas.forEach((fila, indice) => {
                if (fila._orig === undefined) fila._orig = indice;
                Array.from(fila.cells).forEach((celda, i) => {
                    const nombre = nombres[i];
                    if (nombre && celda.getAttribute('data-label') !== nombre) celda.setAttribute('data-label', nombre);
                });
            });

            // Las columnas con solo números se alinean a la derecha
            titulos().forEach((th, i) => {
                const valores = filas
                    .map((fila) => (fila.cells[i] ? fila.cells[i].textContent.trim() : ''))
                    .filter((v) => !esVacio(v));
                const numerica = esOrdenable(th) && valores.length > 0 && valores.every(esNumero);
                th.classList.toggle('col-num', numerica);
                filas.forEach((fila) => {
                    if (fila.cells[i]) fila.cells[i].classList.toggle('col-num', numerica);
                });
            });
        }

        // ---------- Ordenar ----------
        function aplicarOrden() {
            const filas = Array.from(cuerpo.rows);
            if (!filas.length) return;

            let claves;
            if (estado.columna < 0) {
                claves = filas.map((fila) => ({ fila, orig: fila._orig || 0 }));
                claves.sort((x, y) => x.orig - y.orig);
            } else {
                claves = filas.map((fila) => {
                    const valor = valorOrden(fila.cells[estado.columna]);
                    return { fila, vacio: esVacio(valor), valor, orig: fila._orig || 0 };
                });
                claves.sort((x, y) => {
                    if (x.vacio && y.vacio) return x.orig - y.orig;
                    if (x.vacio) return 1;   // los vacíos siempre quedan al final
                    if (y.vacio) return -1;
                    const r = comparar(x.valor, y.valor) * estado.direccion;
                    return r !== 0 ? r : x.orig - y.orig;
                });
            }

            ocupado = true;
            cuerpo.append(...claves.map((c) => c.fila));
            observadorCuerpo.takeRecords();
            ocupado = false;
        }

        function ordenarPor(columna) {
            if (columna < 0) {
                estado.columna = -1;
                estado.direccion = 1;
            } else if (estado.columna === columna) {
                estado.direccion = -estado.direccion;
            } else {
                estado.columna = columna;
                estado.direccion = 1;
            }
            aplicarOrden();
            actualizarControles();
        }

        // ---------- Buscar ----------
        function aplicarBusqueda() {
            const filas = Array.from(cuerpo.rows);
            let visibles = 0;
            filas.forEach((fila) => {
                const coincide = !estado.busqueda || quitarAcentos(fila.textContent).includes(estado.busqueda);
                fila.hidden = !coincide;
                if (coincide) visibles++;
            });
            sinResultados.hidden = !(filas.length > 0 && visibles === 0);
        }

        buscador.addEventListener('input', () => {
            estado.busqueda = quitarAcentos(buscador.value.trim());
            aplicarBusqueda();
        });

        selector.addEventListener('change', () => ordenarPor(Number(selector.value)));
        botonDireccion.addEventListener('click', () => {
            if (estado.columna >= 0) {
                estado.direccion = -estado.direccion;
                aplicarOrden();
                actualizarControles();
            }
        });

        // ---------- Mantenerse al día cuando la tabla se vuelve a llenar ----------
        function alCambiarCuerpo() {
            if (ocupado) return;
            etiquetar();
            aplicarOrden();
            aplicarBusqueda();
        }

        const observadorCuerpo = new MutationObserver(alCambiarCuerpo);
        observadorCuerpo.observe(cuerpo, { childList: true });

        // Proveedores y Clientes generan sus títulos de columna después
        new MutationObserver(() => {
            prepararCabecera();
            etiquetar();
            actualizarControles();
        }).observe(cabecera, { childList: true, subtree: true });

        prepararCabecera();
        etiquetar();
        actualizarControles();
        aplicarBusqueda();
    }

    document.querySelectorAll('.tabla').forEach(iniciar);

    // Se expone para poder probar la lógica de ordenamiento
    window.OmegaTablas = { comparar, esVacio, esNumero, quitarAcentos };
})();
