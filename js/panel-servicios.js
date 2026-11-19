// =========================================
// CATÁLOGO DE SERVICIOS (panel)
//
// - El administrador crea, modifica y activa/desactiva servicios.
// - Los empleados solo consultan el catálogo.
// - Los servicios activos aparecen como sugerencias al agendar una cita.
//
// Requiere: supabase.js y guard.js (cargados antes) y haber corrido sql/servicios.sql.
// Cargar después de panel.js.
// =========================================
(async function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    if (!$('vista-servicios') || !window.sesionLista) return;

    const perfil = await window.sesionLista;
    if (!perfil || (perfil.rol !== 'admin' && perfil.rol !== 'empleado')) return;

    const esAdmin = perfil.rol === 'admin';

    // ---------- Elementos ----------
    const estado = $('estadoServicios');
    const cuerpo = $('cuerpoServicios');
    const botonNuevo = $('botonNuevoServicio');
    botonNuevo.hidden = !esAdmin; // solo el administrador agrega servicios

    const dialogo = $('dialogoServicio');
    const formulario = $('formularioServicio');
    const campoNombre = $('servNombre');
    const campoCategoria = $('servCategoria');
    const campoPrecio = $('servPrecio');
    const campoDuracion = $('servDuracion');
    const campoDescripcion = $('servDescripcion');
    const campoActivo = $('servActivo');
    const bloqueActivo = $('campoActivoServicio');
    const listaCategorias = $('listaCategorias');
    const errorForm = $('errorServicio');
    const botonGuardar = $('botonGuardarServicio');

    const CATEGORIAS_BASE = [
        'Mantenimiento', 'Frenos', 'Motor', 'Suspensión y dirección', 'Sistema eléctrico',
        'Diagnóstico', 'Transmisión', 'Aire acondicionado', 'Llantas', 'Otros'
    ];

    const svg = (trazos) =>
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + trazos + '</svg>';

    const ICONOS = {
        editar: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
        deshabilitar: svg('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'),
        habilitar: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>')
    };

    let servicios = [];
    let modo = 'nuevo';   // 'nuevo' o 'editar'
    let actual = null;

    // ---------- Utilidades ----------
    function formatoPrecio(valor) {
        if (valor === null || valor === undefined) return '—';
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor);
    }

    function textoDuracion(min) {
        if (min < 60) return min + ' min';
        const horas = Math.floor(min / 60);
        const resto = min % 60;
        return horas + (horas === 1 ? ' hora' : ' horas') + (resto ? ' ' + resto + ' min' : '');
    }

    function textoError(error) {
        if (error.code === '23505') return 'Ya existe un servicio con ese nombre.';
        if (error.code === '42P01') return 'Falta crear la tabla de servicios. Corre sql/servicios.sql en Supabase.';
        if (error.code === '42501') return 'Solo el administrador puede modificar el catálogo.';
        return 'No se pudo guardar el servicio. ' + (error.message || '');
    }

    function celda(texto, clase) {
        const td = document.createElement('td');
        td.textContent = texto;
        if (clase) td.className = clase;
        return td;
    }

    function botonIcono(icono, etiqueta, clase, alClic) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'boton-icono ' + (clase || '');
        boton.innerHTML = ICONOS[icono]; // iconos fijos del propio código
        boton.title = etiqueta;
        boton.setAttribute('aria-label', etiqueta);
        boton.addEventListener('click', alClic);
        return boton;
    }

    // ---------- Tabla ----------
    function fila(servicio) {
        const tr = document.createElement('tr');
        if (!servicio.activo) tr.classList.add('deshabilitado');

        tr.appendChild(celda(servicio.nombre));
        tr.appendChild(celda(servicio.categoria || '—'));

        const descripcion = celda(servicio.descripcion || '—', 'celda-larga');
        if (servicio.descripcion) descripcion.title = servicio.descripcion;
        tr.appendChild(descripcion);

        tr.appendChild(celda(formatoPrecio(servicio.precio)));

        const duracion = celda(textoDuracion(servicio.duracion_min));
        duracion.setAttribute('data-orden', String(servicio.duracion_min)); // ordena por minutos, no por texto
        tr.appendChild(duracion);

        const celdaEstado = document.createElement('td');
        const etiqueta = document.createElement('span');
        etiqueta.className = 'etiqueta-servicio ' + (servicio.activo ? 'activo' : 'inactivo');
        etiqueta.textContent = servicio.activo ? 'Activo' : 'Inactivo';
        celdaEstado.appendChild(etiqueta);
        tr.appendChild(celdaEstado);

        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'celda-acciones';
        const acciones = document.createElement('div');
        acciones.className = 'acciones';
        if (esAdmin) {
            acciones.append(
                botonIcono('editar', 'Modificar servicio', '', () => abrirEdicion(servicio)),
                servicio.activo
                    ? botonIcono('deshabilitar', 'Desactivar servicio', 'peligro', () => cambiarActivo(servicio, false))
                    : botonIcono('habilitar', 'Activar servicio', '', () => cambiarActivo(servicio, true))
            );
        }
        celdaAcciones.appendChild(acciones);
        tr.appendChild(celdaAcciones);

        return tr;
    }

    function llenarCategorias() {
        const todas = new Set(CATEGORIAS_BASE);
        servicios.forEach((s) => { if (s.categoria) todas.add(s.categoria); });

        listaCategorias.replaceChildren(...Array.from(todas).sort((a, b) => a.localeCompare(b, 'es')).map((nombre) => {
            const opcion = document.createElement('option');
            opcion.value = nombre;
            return opcion;
        }));
    }

    async function cargar(silencioso) {
        if (!silencioso) estado.textContent = 'Cargando servicios...';

        const { data, error } = await db.from('servicios').select('*').order('nombre', { ascending: true });

        if (error) {
            cuerpo.replaceChildren();
            estado.textContent = 'No se pudo cargar el catálogo. Revisa que corriste el SQL (sql/servicios.sql).';
            return;
        }

        servicios = data;
        cuerpo.replaceChildren(...data.map(fila));
        llenarCategorias();

        const activos = data.filter((s) => s.activo).length;
        if (!data.length) {
            estado.textContent = esAdmin
                ? 'Aún no hay servicios. Usa el botón Nuevo para agregar el primero.'
                : 'Aún no hay servicios en el catálogo.';
        } else {
            estado.textContent = data.length + (data.length === 1 ? ' servicio' : ' servicios') + ' (' + activos + ' activos)';
        }
    }

    async function cambiarActivo(servicio, activo) {
        const { error } = await db.from('servicios').update({ activo: activo }).eq('id', servicio.id);
        if (error) {
            estado.textContent = textoError(error);
            return;
        }
        cargar(true);
    }

    // ---------- Formulario ----------
    function asegurarDuracion(min) {
        const existe = Array.from(campoDuracion.options).some((o) => Number(o.value) === min);
        if (!existe) {
            const opcion = document.createElement('option');
            opcion.value = String(min);
            opcion.textContent = textoDuracion(min);
            campoDuracion.appendChild(opcion);
        }
        campoDuracion.value = String(min);
    }

    function abrirNuevo() {
        modo = 'nuevo';
        actual = null;
        $('tituloServicio').textContent = 'Nuevo servicio';
        errorForm.textContent = '';
        bloqueActivo.hidden = true;
        formulario.reset();
        asegurarDuracion(60);
        dialogo.showModal();
        campoNombre.focus();
    }

    function abrirEdicion(servicio) {
        modo = 'editar';
        actual = servicio;
        $('tituloServicio').textContent = 'Modificar servicio';
        errorForm.textContent = '';
        bloqueActivo.hidden = false;
        formulario.reset();

        campoNombre.value = servicio.nombre || '';
        campoCategoria.value = servicio.categoria || '';
        campoPrecio.value = servicio.precio === null ? '' : String(servicio.precio);
        campoDescripcion.value = servicio.descripcion || '';
        asegurarDuracion(servicio.duracion_min);
        campoActivo.value = servicio.activo ? 'si' : 'no';

        dialogo.showModal();
        campoNombre.focus();
    }

    $('botonCancelarServicio').addEventListener('click', () => dialogo.close());

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        errorForm.textContent = '';

        const nombre = campoNombre.value.trim();
        if (!nombre) {
            errorForm.textContent = 'Escribe el nombre del servicio.';
            return;
        }

        const precio = campoPrecio.value.trim() === '' ? null : Number(campoPrecio.value);
        if (precio !== null && (Number.isNaN(precio) || precio < 0)) {
            errorForm.textContent = 'El precio debe ser un número igual o mayor a cero.';
            return;
        }

        const datos = {
            nombre: nombre,
            categoria: campoCategoria.value.trim() || null,
            descripcion: campoDescripcion.value.trim() || null,
            precio: precio,
            duracion_min: Number(campoDuracion.value)
        };

        botonGuardar.disabled = true;
        try {
            let respuesta;
            if (modo === 'nuevo') {
                respuesta = await db.from('servicios').insert(datos);
            } else {
                datos.activo = campoActivo.value === 'si';
                respuesta = await db.from('servicios').update(datos).eq('id', actual.id);
            }

            if (respuesta.error) {
                errorForm.textContent = textoError(respuesta.error);
                return;
            }

            dialogo.close();
            cargar(true);
        } catch (e) {
            errorForm.textContent = 'Error de conexión. Inténtalo de nuevo.';
        } finally {
            botonGuardar.disabled = false;
        }
    });

    // ---------- Eventos de la vista ----------
    botonNuevo.addEventListener('click', abrirNuevo);

    // Al abrir Servicios desde el menú se cargan los datos
    document.querySelectorAll('[data-vista="servicios"]').forEach((elemento) => {
        elemento.addEventListener('click', () => cargar(false));
    });
})();
