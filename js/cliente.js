// =========================================
// INTERFAZ DEL CLIENTE
// =========================================
(async function () {
    const perfil = await window.sesionLista;
    if (!perfil) return; // guard.js ya lo redirigió

    const nombre = perfil.nombre || perfil.email;
    document.getElementById('nombreCliente').textContent = nombre;
    document.getElementById('botonSalir').addEventListener('click', () => cerrarSesion());

    // --- LÓGICA DEL MENÚ MÓVIL ---
    const botonMenu = document.getElementById('botonMenu');
    const menuLateral = document.getElementById('menuLateral');
    const fondoMenu = document.getElementById('fondoMenu');
    const menuCerrar = document.getElementById('menuCerrar');

    if (botonMenu && menuLateral) {
        // Abrir menú al presionar la hamburguesa
        botonMenu.addEventListener('click', () => {
            menuLateral.classList.add('abierto');
            if (fondoMenu) fondoMenu.classList.add('abierto');
            botonMenu.setAttribute('aria-expanded', 'true');
        });

        // Cerrar menú al presionar la "X" interna
        if (menuCerrar) {
            menuCerrar.addEventListener('click', () => {
                menuLateral.classList.remove('abierto');
                if (fondoMenu) fondoMenu.classList.remove('abierto');
                botonMenu.setAttribute('aria-expanded', 'false');
            });
        }

        // Cerrar menú al hacer clic en el fondo oscuro
        if (fondoMenu) {
            fondoMenu.addEventListener('click', () => {
                menuLateral.classList.remove('abierto');
                fondoMenu.classList.remove('abierto');
                botonMenu.setAttribute('aria-expanded', 'false');
            });
        }
    }

    // --- CAMBIO DE VISTAS (INICIO / CITAS) ---
    const botonesMenu = document.querySelectorAll('.item-menu');
    const vistas = document.querySelectorAll('.vista');

    botonesMenu.forEach(boton => {
        boton.addEventListener('click', () => {
            const vistaDestino = boton.getAttribute('data-vista');
            if (!vistaDestino) return;

            botonesMenu.forEach(b => b.classList.remove('activo'));
            boton.classList.add('activo');

            vistas.forEach(vista => {
                if (vista.id === `vista-${vistaDestino}`) {
                    vista.classList.add('activa');
                } else {
                    vista.classList.remove('activa');
                }
            });

            // Cerrar menú automáticamente en móvil al seleccionar una opción
            if (window.innerWidth < 1024 && menuLateral) {
                menuLateral.classList.remove('abierto');
                if (fondoMenu) fondoMenu.classList.remove('abierto');
                if (botonMenu) botonMenu.setAttribute('aria-expanded', 'false');
            }
        });
    });
})();