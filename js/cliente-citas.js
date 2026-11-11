// =========================================
// CITAS DEL CLIENTE
//
// - Ver sus citas (la base solo le entrega las suyas).
// - Descargarlas en PDF (todas, o una sola).
// - Cancelar una cita que todavía no empieza.
// El cliente NO puede crear ni modificar citas: eso lo hace el personal.
//
// Requiere: supabase.js y guard.js (cargados antes), la librería jsPDF
// y haber corrido sql/citas.sql.
// =========================================
(async function () {
    'use strict';

    const ZONA = 'America/Mexico_City';
    const ESTADOS = {
        programada: 'Programada',
        confirmada: 'Confirmada',
        completada: 'Completada',
        cancelada: 'Cancelada'
    };

    const $ = (id) => document.getElementById(id);

    if (!$('vista-citas') || !window.sesionLista) return;

    const perfil = await window.sesionLista;
    if (!perfil || perfil.rol !== 'cliente') return;

    const nombreCliente = perfil.nombre || perfil.email;
    const estado = $('estadoMisCitas');
    const listaProximas = $('listaProximas');
    const listaHistorial = $('listaHistorial');
    const botonPdf = $('botonPdfCitas');
    const dialogo = $('dialogoCancelarCita');

    let citas = [];

    // ---------- Fechas (siempre en hora de Cuernavaca) ----------
    function partesLocales(iso) {
        const texto = new Date(iso).toLocaleString('sv-SE', { timeZone: ZONA }); // 2026-11-10 09:30:00
        return { fecha: texto.slice(0, 10), hora: texto.slice(11, 16) };
    }

    function sumarMinutos(hhmm, mas) {
        const [h, m] = hhmm.split(':').map(Number);
        const total = h * 60 + m + mas;
        return String(Math.floor(total / 60) % 24).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
    }

    function fechaLarga(iso) {
        return new Date(iso).toLocaleDateString('es-MX', {
            timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    function rangoHora(cita) {
        const inicio = partesLocales(cita.fecha_hora).hora;
        return inicio + ' a ' + sumarMinutos(inicio, cita.duracion_min) + ' hrs';
    }

    function textoDuracion(min) {
        if (min < 60) return min + ' minutos';
        const horas = Math.floor(min / 60);
        const resto = min % 60;
        return horas + (horas === 1 ? ' hora' : ' horas') + (resto ? ' ' + resto + ' min' : '');
    }

    function terminaDespues(cita) {
        return new Date(cita.fecha_hora).getTime() + cita.duracion_min * 60000 > Date.now();
    }

    function puedeCancelar(cita) {
        return (cita.estado === 'programada' || cita.estado === 'confirmada') &&
            new Date(cita.fecha_hora).getTime() > Date.now();
    }

    // ---------- PDF ----------
    function crearPDF(lista, titulo, archivo) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            estado.textContent = 'No se pudo cargar el generador de PDF. Revisa tu conexión e inténtalo de nuevo.';
            return;
        }

        const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
        const margen = 18;
        const ancho = 174;
        const limite = 272;
        let y = 22;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('OMEGA MECHANIC', margen, y);

        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(13);
        doc.text(titulo, margen, y);

        y += 7;
        doc.setFontSize(10);
        doc.text('Cliente: ' + nombreCliente, margen, y);

        y += 5;
        doc.text(
            'Generado el ' + new Date().toLocaleString('es-MX', { timeZone: ZONA, dateStyle: 'long', timeStyle: 'short' }),
            margen, y
        );

        y += 4;
        doc.setDrawColor(0, 160, 180);
        doc.setLineWidth(0.6);
        doc.line(margen, y, margen + ancho, y);
        y += 9;

        if (!lista.length) {
            doc.text('No hay citas para mostrar.', margen, y);
        }

        lista.forEach((cita) => {
            const detalles = [
                'Duración: ' + textoDuracion(cita.duracion_min),
                'Servicio: ' + cita.servicio,
                'Vehículo: ' + (cita.vehiculo || 'No especificado'),
                'Estado: ' + (ESTADOS[cita.estado] || cita.estado)
            ];
            if (cita.notas) detalles.push('Notas: ' + cita.notas);

            const lineas = detalles.flatMap((texto) => doc.splitTextToSize(texto, ancho - 4));
            const alto = 13 + lineas.length * 5 + 6;

            if (y + alto > limite) {
                doc.addPage();
                y = 22;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            const fecha = fechaLarga(cita.fecha_hora);
            doc.text(fecha.charAt(0).toUpperCase() + fecha.slice(1), margen, y);

            y += 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(rangoHora(cita), margen, y);

            y += 6;
            doc.text(lineas, margen + 4, y);
            y += lineas.length * 5 + 3;

            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.line(margen, y, margen + ancho, y);
            y += 7;
        });

        const paginas = doc.getNumberOfPages();
        for (let i = 1; i <= paginas; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(120);
            doc.text('Página ' + i + ' de ' + paginas, margen + ancho, 287, { align: 'right' });
        }

        doc.save(archivo);
    }

    // ---------- Cancelar ----------
    function confirmarCancelacion(cita) {
        return new Promise((resolver) => {
            $('textoCancelarCita').textContent =
                '¿Seguro que quieres cancelar tu cita del ' + fechaLarga(cita.fecha_hora) + ' a las ' +
                partesLocales(cita.fecha_hora).hora + ' hrs (' + cita.servicio + ')?';
            dialogo.returnValue = '';
            dialogo.addEventListener('close', () => resolver(dialogo.returnValue === 'si'), { once: true });
            dialogo.showModal();
        });
    }

    async function cancelar(cita) {
        if (!(await confirmarCancelacion(cita))) return;

        const { error } = await db.rpc('cancelar_mi_cita', { p_id: cita.id });
        if (error) {
            estado.textContent = error.code === 'P0001'
                ? error.message
                : 'No se pudo cancelar la cita. Inténtalo de nuevo.';
            return;
        }

        await cargar();
        estado.textContent = 'Tu cita fue cancelada.';
    }

    // ---------- Tarjetas ----------
    function linea(etiqueta, valor) {
        const p = document.createElement('p');
        p.className = 'cita-detalle';
        const fuerte = document.createElement('strong');
        fuerte.textContent = etiqueta + ': ';
        p.append(fuerte, valor);
        return p;
    }

    function tarjeta(cita) {
        const caja = document.createElement('article');
        caja.className = 'cita-tarjeta ' + cita.estado;

        const encabezado = document.createElement('div');
        encabezado.className = 'cita-encabezado';

        const bloqueFecha = document.createElement('div');
        const fecha = document.createElement('p');
        fecha.className = 'cita-fecha';
        fecha.textContent = fechaLarga(cita.fecha_hora);
        const hora = document.createElement('p');
        hora.className = 'cita-hora';
        hora.textContent = rangoHora(cita);
        bloqueFecha.append(fecha, hora);

        const etiqueta = document.createElement('span');
        etiqueta.className = 'estado-cita ' + cita.estado;
        etiqueta.textContent = ESTADOS[cita.estado] || cita.estado;

        encabezado.append(bloqueFecha, etiqueta);
        caja.appendChild(encabezado);

        caja.appendChild(linea('Servicio', cita.servicio));
        caja.appendChild(linea('Vehículo', cita.vehiculo || 'No especificado'));
        if (cita.notas) caja.appendChild(linea('Notas', cita.notas));

        const acciones = document.createElement('div');
        acciones.className = 'cita-acciones';

        const botonDescargar = document.createElement('button');
        botonDescargar.type = 'button';
        botonDescargar.className = 'boton-secundario';
        botonDescargar.textContent = 'Descargar PDF';
        botonDescargar.addEventListener('click', () => {
            crearPDF([cita], 'Comprobante de cita', 'cita-' + partesLocales(cita.fecha_hora).fecha + '.pdf');
        });
        acciones.appendChild(botonDescargar);

        if (puedeCancelar(cita)) {
            const botonCancelar = document.createElement('button');
            botonCancelar.type = 'button';
            botonCancelar.className = 'boton-peligro';
            botonCancelar.textContent = 'Cancelar cita';
            botonCancelar.addEventListener('click', () => cancelar(cita));
            acciones.appendChild(botonCancelar);
        }

        caja.appendChild(acciones);
        return caja;
    }

    function vacio(texto) {
        const p = document.createElement('p');
        p.className = 'estado-tabla';
        p.textContent = texto;
        return p;
    }

    function pintar() {
        const proximas = citas
            .filter((c) => (c.estado === 'programada' || c.estado === 'confirmada') && terminaDespues(c))
            .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

        const historial = citas
            .filter((c) => !proximas.includes(c))
            .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

        listaProximas.replaceChildren(...(proximas.length ? proximas.map(tarjeta) : [vacio('No tienes citas próximas.')]));
        listaHistorial.replaceChildren(...(historial.length ? historial.map(tarjeta) : [vacio('Todavía no tienes citas anteriores.')]));

        botonPdf.disabled = citas.length === 0;
        estado.textContent = citas.length
            ? 'Para agendar o cambiar una cita, comunícate con el taller.'
            : 'Todavía no tienes citas. Para agendar una, comunícate con el taller.';
    }

    async function cargar() {
        const { data, error } = await db
            .from('citas')
            .select('id, fecha_hora, duracion_min, servicio, vehiculo, notas, estado')
            .order('fecha_hora', { ascending: true });

        if (error) {
            estado.textContent = 'No se pudieron cargar tus citas. Inténtalo más tarde.';
            return;
        }

        citas = data;
        pintar();
    }

    botonPdf.addEventListener('click', () => {
        const todas = citas.slice().sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
        crearPDF(todas, 'Mis citas', 'mis-citas-omega-mechanic.pdf');
    });

    estado.textContent = 'Cargando tus citas...';
    await cargar();
})();
