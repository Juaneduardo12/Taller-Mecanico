// =========================================
// CITAS (panel del administrador y los trabajadores)
//
// - Crear una cita y modificarla (fecha, hora, servicio, estado...).
// - Solo se puede agendar con máximo 2 semanas de anticipación.
// - Las reglas también las exige la base de datos (sql/citas.sql); si cambias
//   algo en CONFIG, cámbialo allá también.
//
// Requiere: supabase.js y guard.js (cargados antes) y haber corrido sql/citas.sql.
// Cargar después de panel.js.
// =========================================
(async function () {
    'use strict';

    // ===== REGLAS DEL TALLER (deben coincidir con sql/citas.sql) =====
    const CONFIG = {
        zona: 'America/Mexico_City',
        offset: '-06:00',   // México ya no usa horario de verano
        apertura: 9,        // 9:00
        cierre: 18,         // 18:00
        paso: 30,           // la hora de inicio se elige cada 30 minutos
        diasMax: 14,        // 2 semanas
        capacidad: 2        // autos al mismo tiempo
    };

    const $ = (id) => document.getElementById(id);

    if (!$('vista-citas') || !window.sesionLista) return;

    const perfil = await window.sesionLista;
    if (!perfil || (perfil.rol !== 'admin' && perfil.rol !== 'empleado')) return;

    const ESTADOS = {
        programada: 'Programada',
        confirmada: 'Confirmada',
        completada: 'Completada',
        cancelada: 'Cancelada'
    };

    const ICONO_EDITAR =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';

    // ---------- Elementos ----------
    const estado = $('estadoCitas');
    const cuerpo = $('cuerpoCitas');
    const filtro = $('filtroCitas');

    // Si el panel ya tenía algún código en este botón, se quita para que no choque con este
    let botonNueva = $('botonNuevaCita');
    const copiaBoton = botonNueva.cloneNode(true);
    botonNueva.replaceWith(copiaBoton);
    botonNueva = copiaBoton;

    const dialogo = $('dialogoCita');
    const formulario = $('formularioCita');
    const campoCliente = $('citaCliente');
    const campoFecha = $('citaFecha');
    const campoDuracion = $('citaDuracion');
    const campoHora = $('citaHora');
    const campoServicio = $('citaServicio');
    const campoVehiculo = $('citaVehiculo');
    const campoNotas = $('citaNotas');
    const listaServicios = $('listaServiciosCatalogo');
    const campoEstado = $('citaEstado');
    const bloqueEstado = $('campoEstadoCita');
    const errorForm = $('errorCita');
    const botonGuardar = $('botonGuardarCita');

    // ---------- Fechas y horas (siempre en hora de Cuernavaca) ----------
    const formatoDia = new Intl.DateTimeFormat('en-CA', {
        timeZone: CONFIG.zona, year: 'numeric', month: '2-digit', day: '2-digit'
    });

    const hoyMX = () => formatoDia.format(new Date());

    function partesLocales(iso) {
        const texto = new Date(iso).toLocaleString('sv-SE', { timeZone: CONFIG.zona }); // 2026-11-10 09:30:00
        return { fecha: texto.slice(0, 10), hora: texto.slice(11, 16) };
    }

    function minutos(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    }

    function hhmm(min) {
        return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
    }

    function sumarDias(fecha, dias) {
        const d = new Date(fecha + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + dias);
        return d.toISOString().slice(0, 10);
    }

    const esDomingo = (fecha) => new Date(fecha + 'T12:00:00Z').getUTCDay() === 0;
    const inicioDia = (fecha) => fecha + 'T00:00:00' + CONFIG.offset;

    function textoFecha(iso) {
        return new Date(iso).toLocaleDateString('es-MX', {
            timeZone: CONFIG.zona, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
        });
    }

    function minutosActualesMX() {
        const texto = new Date().toLocaleString('sv-SE', { timeZone: CONFIG.zona });
        return minutos(texto.slice(11, 16));
    }

    function primerDiaHabil() {
        const hoy = hoyMX();
        return esDomingo(hoy) ? sumarDias(hoy, 1) : hoy;
    }

    function textoError(error) {
        if (error.code === 'P0001') return error.message; // mensajes de las reglas de la base
        if (error.code === '42P01') return 'Falta crear la tabla de citas. Corre sql/citas.sql en Supabase.';
        if (error.code === '42501') return 'No tienes permiso para realizar esta acción.';
        return 'No se pudo guardar la cita. ' + (error.message || '');
    }

    // ---------- Clientes ----------
    let clientes = [];
    let mapaClientes = new Map();
    let fallaClientes = false;   // true si no se pudo leer la lista (por ejemplo, falta correr el SQL)

    const nombreCompleto = (c) => ((c.nombre || '') + ' ' + (c.apellidos || '')).trim();

    async function cargarClientes() {
        const { data, error } = await db.rpc('clientes_para_citas');
        fallaClientes = Boolean(error);
        clientes = error ? [] : data;
        mapaClientes = new Map(clientes.map((c) => [c.id, c]));
        return !error;
    }

    // ---------- Tabla de citas ----------
    function celda(texto, clase) {
        const td = document.createElement('td');
        td.textContent = texto;
        if (clase) td.className = clase;
        return td;
    }

    function filaCita(cita) {
        const fila = document.createElement('tr');
        const local = partesLocales(cita.fecha_hora);
        const cliente = mapaClientes.get(cita.cliente_id);

        const celdaFecha = celda(textoFecha(cita.fecha_hora));
        celdaFecha.setAttribute('data-orden', cita.fecha_hora);
        fila.appendChild(celdaFecha);

        const celdaHora = celda(local.hora);
        celdaHora.setAttribute('data-orden', local.hora);
        const fin = document.createElement('span');
        fin.className = 'cita-hora-fin';
        fin.textContent = ' - ' + hhmm(minutos(local.hora) + cita.duracion_min);
        celdaHora.appendChild(fin);
        fila.appendChild(celdaHora);

        fila.appendChild(celda(cliente ? nombreCompleto(cliente) : '—'));
        fila.appendChild(celda(cliente && cliente.telefono ? cliente.telefono : '—'));
        fila.appendChild(celda(cita.servicio, 'celda-larga'));
        fila.appendChild(celda(cita.vehiculo || '—', 'celda-larga'));

        const celdaEstado = document.createElement('td');
        const etiqueta = document.createElement('span');
        etiqueta.className = 'estado-cita ' + cita.estado;
        etiqueta.textContent = ESTADOS[cita.estado] || cita.estado;
        celdaEstado.appendChild(etiqueta);
        fila.appendChild(celdaEstado);

        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'celda-acciones';
        const acciones = document.createElement('div');
        acciones.className = 'acciones';
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'boton-icono';
        boton.title = 'Modificar cita';
        boton.setAttribute('aria-label', 'Modificar cita');
        boton.innerHTML = ICONO_EDITAR; // icono fijo del propio código
        boton.addEventListener('click', () => abrirEdicion(cita));
        acciones.appendChild(boton);
        celdaAcciones.appendChild(acciones);
        fila.appendChild(celdaAcciones);

        return fila;
    }

    async function cargarCitas(silencioso) {
        if (!silencioso) estado.textContent = 'Cargando citas...';

        const hoy = hoyMX();
        let consulta = db
            .from('citas')
            .select('id, cliente_id, fecha_hora, duracion_min, servicio, vehiculo, notas, estado');

        switch (filtro.value) {
            case 'hoy':
                consulta = consulta
                    .gte('fecha_hora', inicioDia(hoy))
                    .lt('fecha_hora', inicioDia(sumarDias(hoy, 1)))
                    .order('fecha_hora', { ascending: true });
                break;
            case 'completadas':
                consulta = consulta.eq('estado', 'completada').order('fecha_hora', { ascending: false }).limit(100);
                break;
            case 'canceladas':
                consulta = consulta.eq('estado', 'cancelada').order('fecha_hora', { ascending: false }).limit(100);
                break;
            case 'todas':
                consulta = consulta.order('fecha_hora', { ascending: false }).limit(200);
                break;
            default: // próximas
                consulta = consulta
                    .gte('fecha_hora', inicioDia(hoy))
                    .in('estado', ['programada', 'confirmada'])
                    .order('fecha_hora', { ascending: true });
        }

        const [{ data, error }] = await Promise.all([consulta, cargarClientes()]);

        if (error) {
            cuerpo.replaceChildren();
            estado.textContent = 'No se pudieron cargar las citas. Revisa que corriste el SQL (sql/citas.sql).';
            return;
        }

        cuerpo.replaceChildren(...data.map(filaCita));
        estado.textContent = data.length
            ? data.length + (data.length === 1 ? ' cita' : ' citas')
            : 'No hay citas en esta lista.';
    }

    // ---------- Horas disponibles ----------
    let modo = 'nueva';          // 'nueva' o 'editar'
    let citaActual = null;
    let original = null;         // fecha, hora y duración con las que se abrió la edición
    let peticion = 0;

    async function citasDelDia(fecha) {
        const { data, error } = await db
            .from('citas')
            .select('id, fecha_hora, duracion_min')
            .in('estado', ['programada', 'confirmada'])
            .gte('fecha_hora', inicioDia(fecha))
            .lt('fecha_hora', inicioDia(sumarDias(fecha, 1)));

        if (error) return [];
        return data.map((c) => {
            const inicio = minutos(partesLocales(c.fecha_hora).hora);
            return { id: c.id, inicio: inicio, fin: inicio + c.duracion_min };
        });
    }

    function opcion(valor, texto, deshabilitada) {
        const o = document.createElement('option');
        o.value = valor;
        o.textContent = texto;
        o.disabled = Boolean(deshabilitada);
        return o;
    }

    async function actualizarHoras(horaPreferida) {
        const mia = ++peticion;
        const fecha = campoFecha.value;
        const duracion = Number(campoDuracion.value);

        campoHora.replaceChildren(opcion('', 'Cargando horarios...', true));

        if (!fecha) {
            campoHora.replaceChildren(opcion('', 'Primero elige la fecha', true));
            return;
        }
        if (esDomingo(fecha)) {
            campoHora.replaceChildren(opcion('', 'El taller no atiende los domingos', true));
            return;
        }

        const ocupadas = await citasDelDia(fecha);
        if (mia !== peticion) return; // llegó una petición más reciente

        const hoy = hoyMX();
        const ahora = minutosActualesMX();
        const lista = [opcion('', 'Elige la hora de inicio', false)];
        let hayDisponibles = false;

        for (let m = CONFIG.apertura * 60; m + duracion <= CONFIG.cierre * 60; m += CONFIG.paso) {
            const esActual = modo === 'editar' && original &&
                fecha === original.fecha && duracion === original.duracion && hhmm(m) === original.hora;

            if (fecha === hoy && m <= ahora && !esActual) continue; // hoy solo horas que faltan

            const traslapadas = ocupadas.filter((o) =>
                (!citaActual || o.id !== citaActual.id) && m < o.fin && o.inicio < m + duracion
            ).length;
            const llena = traslapadas >= CONFIG.capacidad && !esActual;

            let texto = hhmm(m);
            if (esActual) texto += ' (actual)';
            if (llena) texto += ' - sin lugar';

            lista.push(opcion(hhmm(m), texto, llena));
            if (!llena) hayDisponibles = true;
        }

        if (!hayDisponibles) {
            lista.splice(0, 1, opcion('', 'No hay horarios disponibles ese día', true));
        }

        campoHora.replaceChildren(...lista);

        if (horaPreferida) {
            const elegida = Array.from(campoHora.options).find((o) => o.value === horaPreferida && !o.disabled);
            if (elegida) campoHora.value = horaPreferida;
        }
    }

    // ---------- Catálogo de servicios (sugerencias al escribir el servicio) ----------
    let catalogo = new Map(); // nombre en minúsculas -> duración en minutos

    async function cargarCatalogo() {
        const { data, error } = await db
            .from('servicios')
            .select('nombre, duracion_min')
            .eq('activo', true)
            .order('nombre', { ascending: true });

        catalogo = new Map();
        const opciones = [];
        if (!error && data) {
            data.forEach((servicio) => {
                catalogo.set(servicio.nombre.trim().toLowerCase(), servicio.duracion_min);
                const opcion = document.createElement('option');
                opcion.value = servicio.nombre;
                opciones.push(opcion);
            });
        }
        if (listaServicios) listaServicios.replaceChildren(...opciones);
    }

    // ---------- Formulario (nueva / modificar) ----------
    async function llenarClientes(seleccionado) {
        await cargarClientes();
        const textoInicial = fallaClientes
            ? 'No se pudo cargar la lista de clientes'
            : (clientes.length ? 'Selecciona un cliente' : 'No hay clientes registrados');
        const lista = [opcion('', textoInicial, false)];
        clientes.forEach((c) => {
            lista.push(opcion(String(c.id), nombreCompleto(c) + (c.telefono ? ' - ' + c.telefono : ''), false));
        });
        campoCliente.replaceChildren(...lista);
        if (seleccionado) campoCliente.value = String(seleccionado);
    }

    function limitesDeFecha(fechaMinimaPermitida) {
        const hoy = hoyMX();
        campoFecha.min = fechaMinimaPermitida || hoy;
        campoFecha.max = sumarDias(hoy, CONFIG.diasMax);
    }

    async function abrirNueva() {
        modo = 'nueva';
        citaActual = null;
        original = null;

        $('tituloCita').textContent = 'Nueva cita';
        errorForm.textContent = '';
        bloqueEstado.hidden = true;
        campoCliente.disabled = false;

        formulario.reset();
        await llenarClientes(null);
        limitesDeFecha(null);
        campoFecha.value = primerDiaHabil();
        campoDuracion.value = '60';
        campoEstado.value = 'programada';

        if (fallaClientes) {
            errorForm.textContent =
                'No se pudo cargar la lista de clientes. Revisa que corriste sql/citas.sql completo en Supabase.';
        } else if (!clientes.length) {
            errorForm.textContent = 'Todavía no hay clientes registrados. Pide al administrador que registre primero al cliente.';
        }

        dialogo.showModal();
        cargarCatalogo();
        await actualizarHoras(null);
        campoCliente.focus();
    }

    async function abrirEdicion(cita) {
        modo = 'editar';
        citaActual = cita;
        const local = partesLocales(cita.fecha_hora);
        original = { fecha: local.fecha, hora: local.hora, duracion: cita.duracion_min };

        $('tituloCita').textContent = 'Modificar cita';
        errorForm.textContent = '';
        bloqueEstado.hidden = false;

        formulario.reset();
        await llenarClientes(cita.cliente_id);
        campoCliente.disabled = true; // la cita no cambia de cliente

        // Si la cita ya pasó, se deja su fecha para poder cambiar solo estado o notas
        limitesDeFecha(local.fecha < hoyMX() ? local.fecha : null);
        campoFecha.value = local.fecha;
        campoDuracion.value = String(cita.duracion_min);
        campoServicio.value = cita.servicio || '';
        campoVehiculo.value = cita.vehiculo || '';
        campoNotas.value = cita.notas || '';
        campoEstado.value = cita.estado;

        dialogo.showModal();
        cargarCatalogo();
        await actualizarHoras(local.hora);
    }

    campoFecha.addEventListener('change', () => actualizarHoras(campoHora.value));
    campoDuracion.addEventListener('change', () => actualizarHoras(campoHora.value));

    campoServicio.addEventListener('change', () => {
        if (modo !== 'nueva') return;
        const minutosCatalogo = catalogo.get(campoServicio.value.trim().toLowerCase());
        if (!minutosCatalogo) return;

        // La duración más cercana (hacia arriba) que ofrece el formulario
        const opciones = Array.from(campoDuracion.options).map((o) => Number(o.value));
        const elegida = opciones.find((m) => m >= minutosCatalogo) || opciones[opciones.length - 1];
        campoDuracion.value = String(elegida);
        actualizarHoras(campoHora.value);
    });
    $('botonCancelarCita').addEventListener('click', () => dialogo.close());

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        errorForm.textContent = '';

        const fecha = campoFecha.value;
        const hora = campoHora.value;
        const duracion = Number(campoDuracion.value);
        const servicio = campoServicio.value.trim();

        if (modo === 'nueva' && !campoCliente.value) {
            errorForm.textContent = 'Selecciona al cliente.';
            return;
        }
        if (!fecha || !hora) {
            errorForm.textContent = 'Elige la fecha y una hora disponible.';
            return;
        }
        if (!servicio) {
            errorForm.textContent = 'Escribe el servicio de la cita.';
            return;
        }

        // Las reglas de fecha solo aplican si es nueva o si se cambió la fecha, hora o duración
        const cambioHorario = modo === 'nueva' || !original ||
            fecha !== original.fecha || hora !== original.hora || duracion !== original.duracion;

        if (cambioHorario) {
            const hoy = hoyMX();
            if (fecha < hoy) {
                errorForm.textContent = 'La fecha no puede ser anterior a hoy.';
                return;
            }
            if (fecha > sumarDias(hoy, CONFIG.diasMax)) {
                errorForm.textContent = 'Solo se pueden agendar citas con un máximo de 2 semanas de anticipación.';
                return;
            }
            if (esDomingo(fecha)) {
                errorForm.textContent = 'El taller no atiende los domingos.';
                return;
            }
        }

        const datos = {
            fecha_hora: fecha + 'T' + hora + ':00' + CONFIG.offset,
            duracion_min: duracion,
            servicio: servicio,
            vehiculo: campoVehiculo.value.trim() || null,
            notas: campoNotas.value.trim() || null
        };

        botonGuardar.disabled = true;
        try {
            let respuesta;
            if (modo === 'nueva') {
                datos.cliente_id = Number(campoCliente.value);
                respuesta = await db.from('citas').insert(datos);
            } else {
                datos.estado = campoEstado.value;
                respuesta = await db.from('citas').update(datos).eq('id', citaActual.id);
            }

            if (respuesta.error) {
                errorForm.textContent = textoError(respuesta.error);
                return;
            }

            dialogo.close();
            cargarCitas(true);
        } catch (e) {
            errorForm.textContent = 'Error de conexión. Inténtalo de nuevo.';
        } finally {
            botonGuardar.disabled = false;
        }
    });

    // ---------- Eventos de la vista ----------
    botonNueva.addEventListener('click', abrirNueva);
    filtro.addEventListener('change', () => cargarCitas(false));

    // Al abrir la sección Citas desde el menú se cargan los datos
    document.querySelectorAll('[data-vista="citas"]').forEach((elemento) => {
        elemento.addEventListener('click', () => cargarCitas(false));
    });
})();
