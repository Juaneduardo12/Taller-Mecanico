document.addEventListener('DOMContentLoaded', () => {
    // --- 1. MENÚ HAMBURGUESA ---
    const botonMenu = document.getElementById('botonMenu');
    const botonCerrar = document.getElementById('botonCerrar');
    const menuNav = document.getElementById('menuNav');

    if (botonMenu && menuNav) {
        botonMenu.addEventListener('click', () => {
            menuNav.classList.add('activo');
        });
    }

    if (botonCerrar && menuNav) {
        botonCerrar.addEventListener('click', () => {
            menuNav.classList.remove('activo');
        });
    }

    // --- 2. PESTAÑAS DE LA HISTORIA ---
    const botonesHistoria = document.querySelectorAll('.btn-tab');
    const pantallasHistoria = document.querySelectorAll('.pantalla');

    botonesHistoria.forEach(boton => {
        boton.addEventListener('click', () => {
            const targetId = boton.getAttribute('data-target');

            botonesHistoria.forEach(btn => btn.classList.remove('activo'));
            boton.classList.add('activo');

            pantallasHistoria.forEach(pantalla => {
                pantalla.style.display = 'none';
            });

            const pantallaActiva = document.getElementById(targetId);
            if (pantallaActiva) {
                pantallaActiva.style.display = 'block';
            }
        });
    });

    // --- 3. PESTAÑAS DE CORREO Y PUESTO (TÁCTIL Y MÓVIL) ---
    const pestanasOrg = document.querySelectorAll('.pestana-correo, .pestana-puesto');

    pestanasOrg.forEach(pestana => {
        pestana.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const estaActiva = pestana.classList.contains('activo');
            
            pestanasOrg.forEach(p => p.classList.remove('activo'));

            if (!estaActiva) {
                pestana.classList.add('activo');
            }
        });
    });

    // Cierra tooltips al hacer clic fuera
    document.addEventListener('click', () => {
        pestanasOrg.forEach(p => p.classList.remove('activo'));
    });
});