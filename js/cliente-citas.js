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

    // ---------- PDF (comprobante de cita) ----------
    // Datos de contacto que salen al pie del PDF (cámbialos aquí si hace falta)
    const CONTACTO = {
        lugar: 'Cuernavaca, Morelos, México',
        telefono: '777 5041214',
        correo: 'juaneduardoocampocastillo5@gmail.com'
    };

    const COLORES = {
        negro: [11, 11, 11],
        cian: [0, 234, 255],
        cianOscuro: [0, 140, 158],
        texto: [30, 35, 40],
        gris: [110, 118, 125],
        fondoCian: [236, 249, 251],
        borde: [190, 226, 232],
        arcoiris: [[255, 59, 59], [255, 159, 28], [255, 225, 77], [61, 220, 132], [0, 234, 255], [77, 124, 255], [176, 77, 255]]
    };

    const COLOR_ESTADO = {
        programada: [245, 166, 35],
        confirmada: [0, 160, 180],
        completada: [46, 170, 90],
        cancelada: [220, 70, 70]
    };

    const folioDe = (cita) => 'OM-' + String(cita.id).padStart(5, '0');

    // Logo del taller, recortado en círculo. Si el navegador no deja leer la imagen
    // (por ejemplo al abrir la página desde un archivo local), se dibuja un emblema.
    let logoCache;
    function cargarLogo() {
        if (logoCache !== undefined) return Promise.resolve(logoCache);

        return new Promise((resolver) => {
            // Si existe js/logo-pdf.js se usa el logo incrustado ahí: funciona incluso al abrir
            // la página desde un archivo local. Si no, se intenta cargar la imagen de la carpeta img.
            const origenLogo = (typeof LOGO_PDF_DATA_URL === 'string' && LOGO_PDF_DATA_URL)
                ? LOGO_PDF_DATA_URL
                : 'img/Logotipo_del_taller.jpg';

            const imagen = new Image();
            imagen.onload = () => {
                try {
                    const lado = 400;
                    const lienzo = document.createElement('canvas');
                    lienzo.width = lado;
                    lienzo.height = lado;
                    const ctx = lienzo.getContext('2d');
                    ctx.beginPath();
                    ctx.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();

                    const origen = Math.min(imagen.naturalWidth, imagen.naturalHeight);
                    const sx = (imagen.naturalWidth - origen) / 2;
                    const sy = (imagen.naturalHeight - origen) / 2;
                    ctx.drawImage(imagen, sx, sy, origen, origen, 0, 0, lado, lado);

                    logoCache = lienzo.toDataURL('image/png');
                } catch (e) {
                    logoCache = null;
                }
                resolver(logoCache);
            };
            imagen.onerror = () => {
                logoCache = null;
                resolver(null);
            };
            imagen.src = origenLogo;
        });
    }

    function partesFecha(iso) {
        const partes = new Intl.DateTimeFormat('es-MX', {
            timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }).formatToParts(new Date(iso));
        const dato = (tipo) => (partes.find((p) => p.type === tipo) || {}).value || '';
        return { dia: dato('weekday'), numero: dato('day'), mes: dato('month'), anio: dato('year') };
    }

    const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
    const alturaLinea = (puntos) => puntos * 0.3528 * 1.25;

    function bandaArcoiris(doc, y, alto) {
        const ancho = 210 / COLORES.arcoiris.length;
        COLORES.arcoiris.forEach((color, i) => {
            doc.setFillColor(color[0], color[1], color[2]);
            doc.rect(i * ancho, y, ancho + 0.2, alto, 'F');
        });
    }

    function dibujarLogo(doc, logo, cx, cy, radio) {
        if (logo) {
            doc.addImage(logo, 'PNG', cx - radio, cy - radio, radio * 2, radio * 2);
        } else {
            doc.setFillColor(18, 28, 38);
            doc.circle(cx, cy, radio, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(COLORES.cian[0], COLORES.cian[1], COLORES.cian[2]);
            doc.text('OM', cx, cy + 2.6, { align: 'center' });
        }
        doc.setDrawColor(COLORES.cian[0], COLORES.cian[1], COLORES.cian[2]);
        doc.setLineWidth(1.1);
        doc.circle(cx, cy, radio + 1.2, 'S');
    }

    function encabezadoCompleto(doc, logo, etiqueta, derecha) {
        doc.setFillColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
        doc.rect(0, 0, 210, 56, 'F');
        bandaArcoiris(doc, 56, 3);

        dibujarLogo(doc, logo, 32, 28, 15);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text('OMEGA MECHANIC', 54, 26);

        doc.setFontSize(9);
        doc.setTextColor(COLORES.cian[0], COLORES.cian[1], COLORES.cian[2]);
        doc.setCharSpace(1.6);
        doc.text('AUTOMOTIVE INNOVATION', 54, 33);
        doc.setCharSpace(0);

        doc.setFillColor(COLORES.cian[0], COLORES.cian[1], COLORES.cian[2]);
        doc.roundedRect(138, 12, 54, 9, 4.5, 4.5, 'F');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text(etiqueta, 165, 17.9, { align: 'center' });

        if (derecha) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text(derecha, 192, 32, { align: 'right' });
        }
    }

    function encabezadoMini(doc, etiqueta) {
        doc.setFillColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
        doc.rect(0, 0, 210, 14, 'F');
        bandaArcoiris(doc, 14, 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('OMEGA MECHANIC', 18, 9.3);
        doc.setFontSize(8);
        doc.setTextColor(COLORES.cian[0], COLORES.cian[1], COLORES.cian[2]);
        doc.text(etiqueta, 192, 9, { align: 'right' });
    }

    function pie(doc, pagina, total) {
        doc.setFillColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
        doc.rect(0, 280, 210, 17, 'F');
        doc.setFillColor(COLORES.cian[0], COLORES.cian[1], COLORES.cian[2]);
        doc.rect(0, 280, 210, 0.9, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text('OMEGA MECHANIC  |  ' + CONTACTO.lugar, 105, 287, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(190, 200, 205);
        doc.text('Tel. ' + CONTACTO.telefono + '  |  ' + CONTACTO.correo, 105, 292, { align: 'center' });

        doc.setFontSize(7);
        doc.setTextColor(150, 160, 165);
        doc.text('Página ' + pagina + ' de ' + total, 192, 287, { align: 'right' });
    }

    function etiquetaEstado(doc, estadoCita, x, y, ancho) {
        const color = COLOR_ESTADO[estadoCita] || [120, 120, 120];
        doc.setFillColor(color[0], color[1], color[2]);
        doc.roundedRect(x, y, ancho, 7.5, 3.75, 3.75, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        if (estadoCita === 'programada') doc.setTextColor(40, 25, 0);
        else doc.setTextColor(255, 255, 255);
        doc.text((ESTADOS[estadoCita] || estadoCita).toUpperCase(), x + ancho / 2, y + 5.1, { align: 'center' });
    }

    function altoTarjeta(doc, valor, ancho) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        const lineas = doc.splitTextToSize(valor || '-', ancho - 10);
        return 12 + lineas.length * alturaLinea(10.5);
    }

    function tarjetaDato(doc, etiqueta, valor, x, y, ancho, alto) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        const lineas = doc.splitTextToSize(valor || '-', ancho - 10);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(COLORES.borde[0], COLORES.borde[1], COLORES.borde[2]);
        doc.setLineWidth(0.4);
        doc.roundedRect(x, y, ancho, alto, 2.5, 2.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(COLORES.cianOscuro[0], COLORES.cianOscuro[1], COLORES.cianOscuro[2]);
        doc.setCharSpace(0.6);
        doc.text(etiqueta.toUpperCase(), x + 5, y + 6);
        doc.setCharSpace(0);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(COLORES.texto[0], COLORES.texto[1], COLORES.texto[2]);
        doc.text(lineas, x + 5, y + 11.5);
    }

    function dibujarQR(doc, texto, x, y, tamano) {
        if (typeof window.qrcode !== 'function') return false;
        try {
            const qr = window.qrcode(0, 'M');
            qr.addData(texto);
            qr.make();
            const n = qr.getModuleCount();
            const celda = tamano / n;

            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(COLORES.borde[0], COLORES.borde[1], COLORES.borde[2]);
            doc.setLineWidth(0.4);
            doc.roundedRect(x - 3, y - 3, tamano + 6, tamano + 6, 2.5, 2.5, 'FD');

            doc.setFillColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
            for (let fila = 0; fila < n; fila++) {
                for (let col = 0; col < n; col++) {
                    if (qr.isDark(fila, col)) {
                        doc.rect(x + col * celda, y + fila * celda, celda + 0.05, celda + 0.05, 'F');
                    }
                }
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    // ----- Comprobante de UNA cita -----
    function armarComprobante(doc, logo, cita) {
        const fecha = partesFecha(cita.fecha_hora);
        const hora = partesLocales(cita.fecha_hora).hora;
        const horaFin = sumarMinutos(hora, cita.duracion_min);

        encabezadoCompleto(doc, logo, 'COMPROBANTE DE CITA', 'Folio ' + folioDe(cita));

        // Tarjeta grande con la fecha y la hora
        let y = 68;
        doc.setFillColor(COLORES.fondoCian[0], COLORES.fondoCian[1], COLORES.fondoCian[2]);
        doc.roundedRect(18, y, 174, 48, 3, 3, 'F');
        doc.setFillColor(COLORES.cian[0], COLORES.cian[1], COLORES.cian[2]);
        doc.roundedRect(18, y, 4, 48, 2, 2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(COLORES.cianOscuro[0], COLORES.cianOscuro[1], COLORES.cianOscuro[2]);
        doc.setCharSpace(1.2);
        doc.text(fecha.dia.toUpperCase(), 30, y + 11);
        doc.setCharSpace(0);

        doc.setFontSize(46);
        doc.setTextColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
        doc.text(fecha.numero, 30, y + 34);

        const anchoDia = doc.getTextWidth(fecha.numero);
        doc.setFontSize(17);
        doc.text(fecha.mes.toUpperCase(), 30 + anchoDia + 5, y + 26);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(13);
        doc.setTextColor(COLORES.gris[0], COLORES.gris[1], COLORES.gris[2]);
        doc.text(fecha.anio, 30 + anchoDia + 5, y + 34);

        // Hora y estado
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(COLORES.cianOscuro[0], COLORES.cianOscuro[1], COLORES.cianOscuro[2]);
        doc.setCharSpace(1);
        doc.text('HORA', 130, y + 24);
        doc.setCharSpace(0);

        doc.setFontSize(21);
        doc.setTextColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
        doc.text(hora + ' - ' + horaFin, 130, y + 34);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(COLORES.gris[0], COLORES.gris[1], COLORES.gris[2]);
        doc.text('Duración: ' + textoDuracion(cita.duracion_min), 130, y + 41);

        etiquetaEstado(doc, cita.estado, 152, y + 6, 36);

        // Datos de la cita
        y = 124;
        const ancho2 = 85;
        const altoFila1 = Math.max(
            altoTarjeta(doc, nombreCliente, ancho2),
            altoTarjeta(doc, cita.vehiculo || 'No especificado', ancho2)
        );
        tarjetaDato(doc, 'Cliente', nombreCliente, 18, y, ancho2, altoFila1);
        tarjetaDato(doc, 'Vehículo', cita.vehiculo || 'No especificado', 107, y, ancho2, altoFila1);
        y += altoFila1 + 5;

        const altoServicio = altoTarjeta(doc, cita.servicio, 174);
        tarjetaDato(doc, 'Servicio', cita.servicio, 18, y, 174, altoServicio);
        y += altoServicio + 5;

        if (cita.notas) {
            const altoNotas = altoTarjeta(doc, cita.notas, 174);
            tarjetaDato(doc, 'Notas de la cita', cita.notas, 18, y, 174, altoNotas);
            y += altoNotas + 5;
        }

        // Aviso importante + código QR
        if (y + 46 > 274) {
            doc.addPage();
            encabezadoMini(doc, 'COMPROBANTE DE CITA');
            y = 28;
        }

        doc.setFillColor(255, 248, 230);
        doc.roundedRect(18, y, 125, 40, 2.5, 2.5, 'F');
        doc.setFillColor(245, 166, 35);
        doc.roundedRect(18, y, 3, 40, 1.5, 1.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(170, 105, 0);
        doc.setCharSpace(1);
        doc.text('IMPORTANTE', 27, y + 7);
        doc.setCharSpace(0);

        const avisos = [
            'Llega unos minutos antes de tu cita.',
            'Si no puedes asistir, cancélala desde tu cuenta antes de la hora programada.',
            'Puedes mostrar este comprobante impreso o en tu celular.'
        ];
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(COLORES.texto[0], COLORES.texto[1], COLORES.texto[2]);
        let yAviso = y + 14;
        avisos.forEach((aviso) => {
            const lineas = doc.splitTextToSize(aviso, 108);
            doc.setFillColor(245, 166, 35);
            doc.circle(28, yAviso - 1.2, 0.8, 'F');
            doc.text(lineas, 31.5, yAviso);
            yAviso += lineas.length * alturaLinea(9) + 2.4;
        });

        // QR con el folio
        const textoQR = 'OMEGA MECHANIC | ' + folioDe(cita) + ' | ' + partesLocales(cita.fecha_hora).fecha + ' ' + hora;
        const hayQR = dibujarQR(doc, textoQR, 156, y + 1, 30);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(COLORES.cianOscuro[0], COLORES.cianOscuro[1], COLORES.cianOscuro[2]);
        doc.setCharSpace(1);
        if (hayQR) {
            doc.text('FOLIO', 171, y + 38.5, { align: 'center' });
            doc.setCharSpace(0);
            doc.setFontSize(10);
            doc.setTextColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
            doc.text(folioDe(cita), 171, y + 43.5, { align: 'center' });
        } else {
            doc.text('FOLIO', 171, y + 14, { align: 'center' });
            doc.setCharSpace(0);
            doc.setFontSize(15);
            doc.setTextColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
            doc.text(folioDe(cita), 171, y + 23, { align: 'center' });
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(COLORES.gris[0], COLORES.gris[1], COLORES.gris[2]);
        doc.text(
            'Generado el ' + new Date().toLocaleString('es-MX', { timeZone: ZONA, dateStyle: 'long', timeStyle: 'short' }),
            18, y + 48
        );
    }

    // ----- Lista de varias citas -----
    function armarLista(doc, logo, lista) {
        encabezadoCompleto(doc, logo, 'MIS CITAS', lista.length + (lista.length === 1 ? ' cita' : ' citas'));

        let y = 70;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
        doc.text(nombreCliente, 18, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(COLORES.gris[0], COLORES.gris[1], COLORES.gris[2]);
        doc.text(
            'Generado el ' + new Date().toLocaleString('es-MX', { timeZone: ZONA, dateStyle: 'long', timeStyle: 'short' }),
            18, y + 5.5
        );
        y += 13;

        if (!lista.length) {
            doc.setFontSize(10);
            doc.text('No hay citas para mostrar.', 18, y);
            return;
        }

        lista.forEach((cita) => {
            const fecha = partesFecha(cita.fecha_hora);
            const hora = partesLocales(cita.fecha_hora).hora;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            const detalles = [
                'Servicio: ' + cita.servicio,
                'Vehículo: ' + (cita.vehiculo || 'No especificado')
            ];
            if (cita.notas) detalles.push('Notas: ' + cita.notas);
            const lineas = detalles.flatMap((texto) => doc.splitTextToSize(texto, 150));
            const alto = 22 + lineas.length * alturaLinea(9.5);

            if (y + alto > 274) {
                doc.addPage();
                encabezadoMini(doc, 'MIS CITAS');
                y = 26;
            }

            const color = COLOR_ESTADO[cita.estado] || [120, 120, 120];
            doc.setFillColor(COLORES.fondoCian[0], COLORES.fondoCian[1], COLORES.fondoCian[2]);
            doc.roundedRect(18, y, 174, alto, 3, 3, 'F');
            doc.setFillColor(color[0], color[1], color[2]);
            doc.roundedRect(18, y, 3.5, alto, 1.7, 1.7, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11.5);
            doc.setTextColor(COLORES.negro[0], COLORES.negro[1], COLORES.negro[2]);
            doc.text(
                mayuscula(fecha.dia) + ' ' + fecha.numero + ' de ' + fecha.mes + ' de ' + fecha.anio,
                27, y + 8
            );

            doc.setFontSize(9.5);
            doc.setTextColor(COLORES.cianOscuro[0], COLORES.cianOscuro[1], COLORES.cianOscuro[2]);
            doc.text(
                hora + ' a ' + sumarMinutos(hora, cita.duracion_min) + ' hrs  (' + textoDuracion(cita.duracion_min) + ')',
                27, y + 14
            );

            etiquetaEstado(doc, cita.estado, 154, y + 4, 34);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(COLORES.texto[0], COLORES.texto[1], COLORES.texto[2]);
            doc.text(lineas, 27, y + 21);

            doc.setFontSize(7);
            doc.setTextColor(COLORES.gris[0], COLORES.gris[1], COLORES.gris[2]);
            doc.text(folioDe(cita), 188, y + alto - 2.5, { align: 'right' });

            y += alto + 5;
        });
    }

    async function crearPDF(lista, tipo, archivo) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            estado.textContent = 'No se pudo cargar el generador de PDF. Revisa tu conexión e inténtalo de nuevo.';
            return;
        }

        estado.textContent = 'Preparando tu PDF...';

        try {
            const logo = await cargarLogo();
            const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
            doc.setLineHeightFactor(1.25);

            if (tipo === 'comprobante' && lista.length === 1) armarComprobante(doc, logo, lista[0]);
            else armarLista(doc, logo, lista);

            const paginas = doc.getNumberOfPages();
            for (let i = 1; i <= paginas; i++) {
                doc.setPage(i);
                pie(doc, i, paginas);
            }

            doc.save(archivo);
            pintar(); // vuelve a mostrar el mensaje normal de la pantalla
        } catch (e) {
            estado.textContent = 'No se pudo generar el PDF. Inténtalo de nuevo.';
        }
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
            crearPDF([cita], 'comprobante', 'comprobante-cita-' + partesLocales(cita.fecha_hora).fecha + '.pdf');
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
        crearPDF(todas, 'lista', 'mis-citas-omega-mechanic.pdf');
    });

    estado.textContent = 'Cargando tus citas...';
    await cargar();
})();
