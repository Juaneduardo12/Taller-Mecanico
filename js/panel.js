// =========================================
// DASHBOARD: Inventario, Proveedores y Citas
// Requiere: supabase.js, usuarios.js y guard.js (cargados antes)
// =========================================
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const cuerpo = document.body;
    const esCelular = () => window.matchMedia('(max-width: 767px)').matches;

    const CAMPOS_PROVEEDOR = [
        { nombre: 'nombre',        etiqueta: 'Empresa',            requerido: true, ancho: true },
        { nombre: 'rfc',           etiqueta: 'RFC',                maxlength: 13 },
        { nombre: 'contacto',      etiqueta: 'Persona de contacto' },
        { nombre: 'telefono',      etiqueta: 'Teléfono',           tipo: 'tel' },
        { nombre: 'correo',        etiqueta: 'Correo',             tipo: 'email', larga: true },
        { nombre: 'direccion',     etiqueta: 'Dirección',          ancho: true, larga: true },
        { nombre: 'ciudad',        etiqueta: 'Ciudad' },
        { nombre: 'estado',        etiqueta: 'Estado' },
        { nombre: 'codigo_postal', etiqueta: 'Código postal',      maxlength: 10 },
        { nombre: 'notas',         etiqueta: 'Notas',              tipo: 'textarea', ancho: true, larga: true }
    ];

    const SVG = (trazos) =>
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + trazos + '</svg>';

    const ICONOS = {
        mas:          SVG('<path d="M12 5v14M5 12h14"/>'),
        menos:        SVG('<path d="M5 12h14"/>'),
        deshabilitar: SVG('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'),
        habilitar:    SVG('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>'),
        editar:       SVG('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
        borrar:       SVG('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>')
    };

    function celda(texto, clase) {
        const td = document.createElement('td');
        td.textContent = texto;
        if (clase) td.className = clase;
        return td;
    }

    function botonIcono(icono, etiqueta, clase, alClic, deshabilitado) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'boton-icono ' + (clase || '');
        boton.innerHTML = ICONOS[icono];
        boton.title = etiqueta;
        boton.setAttribute('aria-label', etiqueta);
        boton.disabled = Boolean(deshabilitado);
        boton.addEventListener('click', alClic);
        return boton;
    }

    function formatoPrecio(valor) {
        if (valor === null || valor === undefined) return '—';
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor);
    }

    function textoError(error) {
        if (error.code === '23505') return 'Ya existe un registro con ese código.';
        if (error.code === '42P01') return 'Falta crear la tabla en Supabase. Corre el SQL.';
        return 'No se pudo completar la acción. ' + (error.message || '');
    }

    const botonMenu = $('botonMenu');
    const fondoMenu = $('fondoMenu');

    function abrirMenu(abierto) {
        cuerpo.classList.toggle('menu-abierto', abierto);
        botonMenu.setAttribute('aria-expanded', String(abierto));
    }

    abrirMenu(!esCelular());
    botonMenu.addEventListener('click', () => abrirMenu(!cuerpo.classList.contains('menu-abierto')));
    fondoMenu.addEventListener('click', () => abrirMenu(false));

    function mostrarVista(nombre, idResaltar) {
        document.querySelectorAll('.vista').forEach((vista) => {
            vista.classList.toggle('activa', vista.id === 'vista-' + nombre);
        });
        document.querySelectorAll('.item-menu').forEach((item) => {
            item.classList.toggle('activo', item.dataset.vista === nombre);
        });

        if (nombre === 'inventario') cargarInventario(false);
        if (nombre === 'proveedores') cargarProveedores(false, idResaltar);
        if (nombre === 'clientes') cargarClientes(false);
        if (nombre === 'citas') cargarCitas(false);
        if (nombre === 'alta-cliente') prepararAltaCliente();

        if (esCelular()) abrirMenu(false);
        window.scrollTo(0, 0);
    }

    document.querySelectorAll('[data-vista]').forEach((elemento) => {
        elemento.addEventListener('click', () => mostrarVista(elemento.dataset.vista));
    });

    $('botonSalir').addEventListener('click', () => cerrarSesion());

    const dialogoForm = $('dialogoFormulario');
    const formulario = $('formularioDialogo');
    const errorForm = $('errorFormulario');
    const botonGuardar = $('botonGuardarFormulario');
    let camposActuales = [];
    let accionGuardar = null;

    function crearCampo(campo, valor, prefijo = 'f_') {
        const caja = document.createElement('div');
        caja.className = 'campo-form' + (campo.ancho ? ' ancho-completo' : '');

        const etiqueta = document.createElement('label');
        etiqueta.htmlFor = prefijo + campo.nombre;
        etiqueta.textContent = campo.etiqueta + (campo.requerido ? ' *' : '');

        let control;
        if (campo.tipo === 'textarea') {
            control = document.createElement('textarea');
            control.rows = 3;
        } else if (campo.tipo === 'select') {
            control = document.createElement('select');
            (campo.opciones || []).forEach((op) => {
                const opcion = document.createElement('option');
                opcion.value = op.valor;
                opcion.textContent = op.texto;
                control.appendChild(opcion);
            });
        } else {
            control = document.createElement('input');
            control.type = campo.tipo || 'text';
            if (campo.tipo === 'number') {
                control.min = '0';
                control.step = campo.paso || '1';
            }
        }

        control.id = prefijo + campo.nombre;
        control.name = campo.nombre;
        control.required = Boolean(campo.requerido);
        if (campo.maxlength) control.maxLength = campo.maxlength;
        if (valor !== undefined && valor !== null) control.value = valor;

        caja.append(etiqueta, control);
        return caja;
    }

    function abrirFormulario(opciones) {
        camposActuales = opciones.campos;
        accionGuardar = opciones.alGuardar;
        const valores = opciones.valores || {};

        $('tituloFormulario').textContent = opciones.titulo;
        botonGuardar.textContent = opciones.textoGuardar || 'Guardar';
        errorForm.textContent = '';

        const contenedor = $('camposFormulario');
        contenedor.replaceChildren();
        camposActuales.forEach((campo) => contenedor.appendChild(crearCampo(campo, valores[campo.nombre])));

        dialogoForm.showModal();
        const primero = contenedor.querySelector('input, select, textarea');
        if (primero) primero.focus();
    }

    $('botonCancelarFormulario').addEventListener('click', () => dialogoForm.close());

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const valores = {};
        for (const campo of camposActuales) {
            let valor = $('f_' + campo.nombre).value.trim();
            if (campo.requerido && valor === '') {
                errorForm.textContent = 'Completa el campo: ' + campo.etiqueta + '.';
                return;
            }
            if (valor === '') valor = null;
            else if (campo.tipo === 'number' || campo.numerico) valor = Number(valor);
            valores[campo.nombre] = valor;
        }

        botonGuardar.disabled = true;
        errorForm.textContent = '';

        try {
            const mensaje = await accionGuardar(valores);
            if (mensaje) errorForm.textContent = mensaje;
            else dialogoForm.close();
        } catch (e) {
            errorForm.textContent = 'Error de conexión. Inténtalo de nuevo.';
        } finally {
            botonGuardar.disabled = false;
        }
    });

    const dialogoConfirmar = $('dialogoConfirmar');

    function confirmar(titulo, texto, textoBoton) {
        return new Promise((resolver) => {
            $('tituloConfirmar').textContent = titulo;
            $('textoConfirmar').textContent = texto;
            $('botonConfirmarOk').textContent = textoBoton || 'Confirmar';
            dialogoConfirmar.returnValue = '';
            dialogoConfirmar.addEventListener(
                'close',
                () => resolver(dialogoConfirmar.returnValue === 'ok'),
                { once: true }
            );
            dialogoConfirmar.showModal();
        });
    }

    const estadoInventario = $('estadoInventario');
    const cuerpoInventario = $('cuerpoInventario');

    async function obtenerProveedores() {
        const { data, error } = await db.from('proveedores').select('id, nombre').order('nombre');
        return error ? [] : data;
    }

    async function actualizarContador() {
        const { count, error } = await db
            .from('inventario')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);
        $('contadorProductos').textContent = error ? '–' : String(count || 0);
    }

    function filaProducto(producto) {
        const fila = document.createElement('tr');
        if (!producto.activo) fila.classList.add('deshabilitado');
        fila.appendChild(celda(producto.codigo || '—'));

        const celdaNombre = celda(producto.nombre);
        if (!producto.activo) {
            const etiqueta = document.createElement('span');
            etiqueta.className = 'etiqueta-estado';
            etiqueta.textContent = 'Deshabilitado';
            celdaNombre.appendChild(etiqueta);
        }
        fila.appendChild(celdaNombre);

        fila.appendChild(celda(producto.categoria || '—'));
        fila.appendChild(celda(producto.marca || '—'));
        fila.appendChild(celda(formatoPrecio(producto.precio)));

        const bajo = producto.stock_minimo > 0 && producto.stock <= producto.stock_minimo;
        fila.appendChild(celda(producto.stock, bajo ? 'stock-bajo' : ''));

        const celdaProveedor = document.createElement('td');
        if (producto.proveedor) {
            const enlace = document.createElement('button');
            enlace.type = 'button';
            enlace.className = 'enlace-proveedor';
            enlace.textContent = producto.proveedor.nombre;
            enlace.title = 'Ver en Proveedores';
            enlace.addEventListener('click', () => mostrarVista('proveedores', producto.proveedor.id));
            celdaProveedor.appendChild(enlace);
        } else {
            celdaProveedor.textContent = '—';
        }
        fila.appendChild(celdaProveedor);

        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'celda-acciones';
        const acciones = document.createElement('div');
        acciones.className = 'acciones';
        acciones.append(
            botonIcono('mas', 'Aumentar existencias (+1)', '', () => ajustarStock(producto.id, 1), !producto.activo),
            botonIcono('menos', 'Disminuir existencias (−1)', '', () => ajustarStock(producto.id, -1), !producto.activo || producto.stock <= 0),
            producto.activo
                ? botonIcono('deshabilitar', 'Deshabilitar producto', 'peligro', () => cambiarActivo(producto, false))
                : botonIcono('habilitar', 'Habilitar producto', '', () => cambiarActivo(producto, true))
        );
        celdaAcciones.appendChild(acciones);
        fila.appendChild(celdaAcciones);
        return fila;
    }

    async function cargarInventario(silencioso) {
        if (!silencioso) estadoInventario.textContent = 'Cargando inventario...';
        const { data, error } = await db
            .from('inventario')
            .select('id, codigo, nombre, categoria, marca, precio, stock, stock_minimo, activo, proveedor:proveedores(id, nombre)')
            .order('nombre', { ascending: true });

        if (error) {
            cuerpoInventario.replaceChildren();
            estadoInventario.textContent = 'No se pudo cargar el inventario.';
            return;
        }

        cuerpoInventario.replaceChildren(...data.map(filaProducto));
        $('contadorProductos').textContent = String(data.filter((p) => p.activo).length);
        estadoInventario.textContent = data.length ? data.length + (data.length === 1 ? ' producto' : ' productos') : 'Aún no hay productos.';
    }

    async function ajustarStock(id, cambio) {
        const { error } = await db.rpc('ajustar_stock', { p_id: id, p_cambio: cambio });
        if (error) return;
        cargarInventario(true);
    }

    async function cambiarActivo(producto, activo) {
        const { error } = await db.from('inventario').update({ activo: activo }).eq('id', producto.id);
        if (error) return;
        cargarInventario(true);
    }

    async function nuevoProducto() {
        const proveedores = await obtenerProveedores();
        const campos = [
            { nombre: 'codigo',       etiqueta: 'Código / SKU' },
            { nombre: 'nombre',       etiqueta: 'Producto', requerido: true },
            { nombre: 'categoria',    etiqueta: 'Categoría' },
            { nombre: 'marca',        etiqueta: 'Marca' },
            { nombre: 'precio',       etiqueta: 'Precio', tipo: 'number', paso: '0.01' },
            { nombre: 'stock',        etiqueta: 'Stock inicial', tipo: 'number', requerido: true },
            { nombre: 'stock_minimo', etiqueta: 'Stock mínimo (alerta)', tipo: 'number', requerido: true },
            {
                nombre: 'proveedor_id', etiqueta: 'Proveedor', tipo: 'select', numerico: true,
                opciones: [{ valor: '', texto: 'Sin proveedor' }].concat(
                    proveedores.map((p) => ({ valor: p.id, texto: p.nombre }))
                )
            }
        ];

        abrirFormulario({
            titulo: 'Nuevo producto',
            campos: campos,
            valores: { stock: 0, stock_minimo: 0 },
            alGuardar: async (valores) => {
                const { error } = await db.from('inventario').insert(valores);
                if (error) return textoError(error);
                cargarInventario(true);
                return null;
            }
        });
    }

    $('botonNuevoProducto').addEventListener('click', nuevoProducto);

    const estadoProveedores = $('estadoProveedores');
    const cuerpoProveedores = $('cuerpoProveedores');

    (function crearEncabezados() {
        const fila = $('encabezadoProveedores');
        CAMPOS_PROVEEDOR.forEach((campo) => {
            const th = document.createElement('th');
            th.textContent = campo.etiqueta;
            fila.appendChild(th);
        });
        const acciones = document.createElement('th');
        acciones.textContent = 'Acciones';
        fila.appendChild(acciones);
    })();

    function filaProveedor(proveedor) {
        const fila = document.createElement('tr');
        fila.dataset.id = proveedor.id;
        CAMPOS_PROVEEDOR.forEach((campo) => {
            const valor = proveedor[campo.nombre];
            const td = celda(valor || '—', campo.larga ? 'celda-larga' : '');
            if (campo.larga && valor) td.title = valor;
            fila.appendChild(td);
        });

        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'celda-acciones';
        const acciones = document.createElement('div');
        acciones.className = 'acciones';
        acciones.append(
            botonIcono('editar', 'Editar proveedor', '', () => editarProveedor(proveedor)),
            botonIcono('borrar', 'Borrar proveedor', 'peligro', () => borrarProveedor(proveedor))
        );
        celdaAcciones.appendChild(acciones);
        fila.appendChild(celdaAcciones);
        return fila;
    }

    async function cargarProveedores(silencioso, idResaltar) {
        if (!silencioso) estadoProveedores.textContent = 'Cargando proveedores...';
        const { data, error } = await db.from('proveedores').select('*').order('nombre', { ascending: true });
        if (error) {
            cuerpoProveedores.replaceChildren();
            estadoProveedores.textContent = 'No se pudieron cargar los proveedores.';
            return;
        }
        cuerpoProveedores.replaceChildren(...data.map(filaProveedor));
        estadoProveedores.textContent = data.length ? data.length + (data.length === 1 ? ' proveedor' : ' proveedores') : 'Aún no hay proveedores.';

        if (idResaltar) {
            const fila = cuerpoProveedores.querySelector('tr[data-id="' + Number(idResaltar) + '"]');
            if (fila) {
                fila.classList.add('resaltada');
                fila.scrollIntoView({ block: 'center', behavior: 'smooth' });
                setTimeout(() => fila.classList.remove('resaltada'), 2600);
            }
        }
    }

    function nuevoProveedor() {
        abrirFormulario({
            titulo: 'Nuevo proveedor',
            campos: CAMPOS_PROVEEDOR,
            alGuardar: async (valores) => {
                const { error } = await db.from('proveedores').insert(valores);
                if (error) return textoError(error);
                cargarProveedores(true);
                return null;
            }
        });
    }

    function editarProveedor(proveedor) {
        abrirFormulario({
            titulo: 'Editar proveedor',
            campos: CAMPOS_PROVEEDOR,
            valores: proveedor,
            textoGuardar: 'Guardar cambios',
            alGuardar: async (valores) => {
                const { error } = await db.from('proveedores').update(valores).eq('id', proveedor.id);
                if (error) return textoError(error);
                cargarProveedores(true);
                return null;
            }
        });
    }

    async function borrarProveedor(proveedor) {
        const acepto = await confirmar('Borrar proveedor', '¿Seguro que quieres borrar a "' + proveedor.nombre + '"?', 'Borrar');
        if (!acepto) return;
        const { error } = await db.from('proveedores').delete().eq('id', proveedor.id);
        if (error) return;
        cargarProveedores(true);
    }

    $('botonNuevoProveedor').addEventListener('click', nuevoProveedor);

    const CAMPOS_CLIENTE = [
        { nombre: 'nombre',    etiqueta: 'Nombre',    requerido: true },
        { nombre: 'apellidos', etiqueta: 'Apellidos' },
        { nombre: 'telefono',  etiqueta: 'Teléfono',  tipo: 'tel' },
        { nombre: 'correo',    etiqueta: 'Correo',    tipo: 'email', larga: true },
        { nombre: 'direccion', etiqueta: 'Dirección', ancho: true, larga: true },
        { nombre: 'ciudad',    etiqueta: 'Ciudad' },
        { nombre: 'notas',     etiqueta: 'Notas',     tipo: 'textarea', ancho: true, larga: true }
    ];

    const estadoClientes = $('estadoClientes');
    const cuerpoClientes = $('cuerpoClientes');

    (function crearEncabezadosClientes() {
        const fila = $('encabezadoClientes');
        CAMPOS_CLIENTE.forEach((campo) => {
            const th = document.createElement('th');
            th.textContent = campo.etiqueta;
            fila.appendChild(th);
        });
        ['Cuenta', 'Acciones'].forEach((titulo) => {
            const th = document.createElement('th');
            th.textContent = titulo;
            fila.appendChild(th);
        });
    })();

    function filaCliente(cliente) {
        const fila = document.createElement('tr');
        fila.dataset.id = cliente.id;

        CAMPOS_CLIENTE.forEach((campo) => {
            const valor = cliente[campo.nombre];
            const td = celda(valor || '—', campo.larga ? 'celda-larga' : '');
            if (campo.larga && valor) td.title = valor;
            fila.appendChild(td);
        });

        const celdaCuenta = document.createElement('td');
        const etiqueta = document.createElement('span');
        etiqueta.className = 'etiqueta-cuenta' + (cliente.user_id ? ' con-cuenta' : '');
        etiqueta.textContent = cliente.user_id ? 'Con cuenta' : 'Sin cuenta';
        celdaCuenta.appendChild(etiqueta);
        fila.appendChild(celdaCuenta);

        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'celda-acciones';
        const acciones = document.createElement('div');
        acciones.className = 'acciones';
        acciones.append(
            botonIcono('editar', 'Editar cliente', '', () => editarCliente(cliente)),
            botonIcono('borrar', 'Borrar cliente', 'peligro', () => borrarCliente(cliente))
        );
        celdaAcciones.appendChild(acciones);
        fila.appendChild(celdaAcciones);
        return fila;
    }

    async function contarClientes() {
        const { count, error } = await db.from('clientes').select('*', { count: 'exact', head: true });
        $('contadorClientes').textContent = error ? '–' : String(count || 0);
    }

    async function cargarClientes(silencioso) {
        if (!silencioso) estadoClientes.textContent = 'Cargando clientes...';
        const { data, error } = await db.from('clientes').select('*').order('nombre', { ascending: true });
        if (error) {
            cuerpoClientes.replaceChildren();
            estadoClientes.textContent = 'No se pudieron cargar los clientes.';
            return;
        }
        cuerpoClientes.replaceChildren(...data.map(filaCliente));
        $('contadorClientes').textContent = String(data.length);
        estadoClientes.textContent = data.length ? data.length + (data.length === 1 ? ' cliente' : ' clientes') : 'Aún no hay clientes.';
    }

    function editarCliente(cliente) {
        abrirFormulario({
            titulo: 'Editar cliente',
            campos: CAMPOS_CLIENTE,
            valores: cliente,
            textoGuardar: 'Guardar cambios',
            alGuardar: async (valores) => {
                const { error } = await db.from('clientes').update(valores).eq('id', cliente.id);
                if (error) return textoError(error);
                cargarClientes(true);
                return null;
            }
        });
    }

    async function borrarCliente(cliente) {
        let texto = '¿Seguro que quieres borrar a "' + cliente.nombre + '"?';
        const acepto = await confirmar('Borrar cliente', texto, 'Borrar');
        if (!acepto) return;
        const { error } = await db.from('clientes').delete().eq('id', cliente.id);
        if (error) return;
        cargarClientes(true);
    }

    $('botonNuevoCliente').addEventListener('click', () => mostrarVista('alta-cliente'));

    const formAlta = $('formAltaCliente');
    const camposAlta = $('camposAltaCliente');
    const mensajeAlta = $('mensajeAltaCliente');
    const botonGuardarAlta = $('botonGuardarAlta');
    let altaConstruida = false;

    function mostrarMensajeAlta(texto, tipo) {
        mensajeAlta.textContent = texto;
        mensajeAlta.className = 'mensaje-alta ' + (tipo || '');
    }

    function limpiarAlta() {
        formAlta.reset();
    }

    function generarContraseñaSegura() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$*!";
        let password = "";
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    function prepararAltaCliente() {
        if (!altaConstruida) {
            CAMPOS_CLIENTE.forEach((campo) => camposAlta.appendChild(crearCampo(campo, '', 'alta_')));
            altaConstruida = true;

            const campoCorreo = $('alta_correo');
            campoCorreo.addEventListener('input', () => {
                $('altaUsuario').value = campoCorreo.value.trim();
            });

            const botonGenerar = $('botonGenerarClave');
            if (botonGenerar) {
                botonGenerar.addEventListener('click', () => {
                    const claveAleatoria = generarContraseñaSegura();
                    $('altaClave').value = claveAleatoria;
                    $('altaClave2').value = claveAleatoria;
                    mostrarMensajeAlta('Contraseña generada automáticamente. Cópiala antes de guardar.', 'ok');
                });
            }
        }
        mostrarMensajeAlta('');
        const primero = camposAlta.querySelector('input');
        if (primero) primero.focus();
    }

    function clienteTemporal() {
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storageKey: 'omega-alta-cliente'
            }
        });
    }

    function textoErrorCuenta(error) {
        if (error.code === 'user_already_exists') return 'Ese correo ya tiene una cuenta.';
        if (error.code === 'weak_password') return 'La contraseña es muy débil.';
        if (error.status === 429) return 'Demasiados intentos. Espera unos minutos.';
        return 'No se pudo crear la cuenta. ' + (error.message || '');
    }

    formAlta.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        mostrarMensajeAlta('');

        const valores = {};
        for (const campo of CAMPOS_CLIENTE) {
            const valor = $('alta_' + campo.nombre).value.trim();
            if (campo.requerido && valor === '') {
                mostrarMensajeAlta('Completa el campo: ' + campo.etiqueta + '.', 'error');
                return;
            }
            valores[campo.nombre] = valor === '' ? null : valor;
        }

        const conCuenta = $('altaClave').value !== '' || $('altaClave2').value !== '';
        let clave = '';

        if (conCuenta) {
            clave = $('altaClave').value;
            if (!valores.correo) {
                mostrarMensajeAlta('Para crear el acceso escribe el correo del cliente.', 'error');
                return;
            }
            if (clave.length < 8) {
                mostrarMensajeAlta('La contraseña debe tener al menos 8 caracteres.', 'error');
                return;
            }
            if (clave !== $('altaClave2').value) {
                mostrarMensajeAlta('Las contraseñas no coinciden.', 'error');
                return;
            }
            if (!$('altaAviso').checked) {
                mostrarMensajeAlta('Confirma que el cliente acepta el Aviso de Privacidad.', 'error');
                return;
            }
        }

        botonGuardarAlta.disabled = true;
        try {
            if (!conCuenta) {
                const { error } = await db.from('clientes').insert(valores);
                if (error) {
                    mostrarMensajeAlta(textoError(error), 'error');
                    return;
                }
                limpiarAlta();
                mostrarMensajeAlta('Cliente registrado correctamente (sin acceso).', 'ok');
            } else {
                const { data, error } = await clienteTemporal().auth.signUp({
                    email: valores.correo,
                    password: clave,
                    options: {
                        data: {
                            registro: 'cliente',
                            nombre: valores.nombre,
                            apellidos: valores.apellidos || '',
                            telefono: valores.telefono || '',
                            acepto_aviso: true,
                            version_aviso: AVISO_VERSION
                        }
                    }
                });

                if (error) {
                    mostrarMensajeAlta(textoErrorCuenta(error), 'error');
                    return;
                }

                const nuevo = data.user;
                if (!nuevo || (nuevo.identities && nuevo.identities.length === 0)) {
                    mostrarMensajeAlta('Ese correo ya tiene una cuenta.', 'error');
                    return;
                }

                const { error: errorExtra } = await db
                    .from('clientes')
                    .update({ direccion: valores.direccion, ciudad: valores.ciudad, notas: valores.notas })
                    .eq('user_id', nuevo.id);

                const claveUsada = clave;
                limpiarAlta();

                if (errorExtra) {
                    mostrarMensajeAlta('La cuenta se creó, pero faltaron algunos datos adicionales.', 'error');
                } else {
                    mostrarMensajeAlta(`¡Cliente registrado con éxito! 🔑 Contraseña generada: [ ${claveUsada} ]`, 'ok');
                }
            }

            contarClientes();
            const primero = camposAlta.querySelector('input');
            if (primero) primero.focus();
        } catch (e) {
            mostrarMensajeAlta('Error de conexión. Inténtalo de nuevo.', 'error');
        } finally {
            botonGuardarAlta.disabled = false;
        }
    });

    $('botonLimpiarAlta').addEventListener('click', () => {
        limpiarAlta();
        mostrarMensajeAlta('');
    });

    $('botonVerClientes').addEventListener('click', () => mostrarVista('clientes'));

    // =========================================
    // MÓDULO DE CITAS
    // =========================================
    const estadoCitas = $('estadoCitas');
    const cuerpoCitas = $('cuerpoCitas');

    async function cargarCitas(silencioso) {
        if (!silencioso) estadoCitas.textContent = 'Cargando citas...';
        estadoCitas.textContent = 'Aún no hay citas registradas.';
        cuerpoCitas.replaceChildren();
    }

    if ($('botonNuevaCita')) {
        $('botonNuevaCita').addEventListener('click', () => {
            alert('Próximamente formulario para agendar citas.');
        });
    }

    window.sesionLista.then((perfil) => {
        if (!perfil) return;
        const lista = (typeof USUARIOS_TALLER !== 'undefined') ? USUARIOS_TALLER : [];
        const conocido = lista.find((u) => u.correo.toLowerCase() === perfil.email.toLowerCase());
        const nombre = (perfil.nombre && perfil.nombre !== perfil.email)
            ? perfil.nombre
            : (conocido ? conocido.nombre : perfil.email);

        $('nombreUsuario').textContent = nombre;
        $('nombreUsuario').title = perfil.email;

        const esAdmin = perfil.rol === 'admin';
        $('menuClientes').hidden = !esAdmin;
        $('tarjetaClientes').hidden = !esAdmin;

        actualizarContador();
        if (esAdmin) contarClientes();
    });
})();