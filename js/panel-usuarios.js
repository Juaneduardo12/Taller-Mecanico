// =========================================
// TABLA DE USUARIOS (tarjeta "Usuarios" del panel)
//
// Solo la ve el administrador (la base también lo exige: únicamente el
// administrador puede leer todos los perfiles).
// Requiere: supabase.js y guard.js (cargados antes) y haber corrido sql/usuarios.sql.
// Cargar después de panel.js.
// =========================================
(async function () {
    const tarjeta = document.getElementById('tarjetaUsuarios');
    const cuerpo = document.getElementById('cuerpoUsuarios');
    const estado = document.getElementById('estadoUsuarios');
    const contador = document.getElementById('contadorUsuarios');

    if (!tarjeta || !cuerpo || !estado || !window.sesionLista) return;

    const perfil = await window.sesionLista;
    if (!perfil || perfil.rol !== 'admin') return; // para los demás, la tarjeta sigue oculta

    tarjeta.hidden = false;

    const ROLES = { admin: 'Administrador', empleado: 'Empleado', cliente: 'Cliente' };
    const ORDEN = { admin: 0, empleado: 1, cliente: 2 };

    function celda(texto, clase) {
        const td = document.createElement('td');
        td.textContent = texto;
        if (clase) td.className = clase;
        return td;
    }

    function fila(usuario) {
        const tr = document.createElement('tr');

        tr.appendChild(celda(usuario.nombre || '—'));

        const correo = celda(usuario.correo || '—', 'celda-larga');
        if (usuario.correo) correo.title = usuario.correo;
        tr.appendChild(correo);

        const celdaRol = document.createElement('td');
        const etiqueta = document.createElement('span');
        etiqueta.className = 'etiqueta-rol ' + usuario.rol;
        etiqueta.textContent = ROLES[usuario.rol] || usuario.rol;
        celdaRol.appendChild(etiqueta);
        tr.appendChild(celdaRol);

        const fecha = usuario.creado_en
            ? new Date(usuario.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
        tr.appendChild(celda(fecha));

        return tr;
    }

    async function cargar() {
        estado.textContent = 'Cargando usuarios...';

        const { data, error } = await db
            .from('perfiles')
            .select('id, nombre, correo, rol, creado_en')
            .order('nombre', { ascending: true });

        if (error) {
            cuerpo.replaceChildren();
            estado.textContent =
                'No se pudieron cargar los usuarios. Revisa que corriste el SQL (sql/usuarios.sql) y que tu usuario sea administrador.';
            return;
        }

        // Primero administradores, luego empleados y al final clientes
        data.sort((a, b) => (ORDEN[a.rol] ?? 9) - (ORDEN[b.rol] ?? 9));

        cuerpo.replaceChildren(...data.map(fila));
        contador.textContent = String(data.length);
        estado.textContent = data.length + (data.length === 1 ? ' usuario' : ' usuarios');
    }

    // Al abrir la vista con la tarjeta, se cargan los datos
    // (el cambio de vista lo hace panel.js con el atributo data-vista de la tarjeta)
    tarjeta.addEventListener('click', cargar);

    // Número de la insignia desde el inicio
    const { count, error } = await db.from('perfiles').select('*', { count: 'exact', head: true });
    contador.textContent = error ? '–' : String(count || 0);
})();
