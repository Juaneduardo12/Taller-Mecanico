const botones = document.querySelectorAll('.btn-tab');
        const pantallas = document.querySelectorAll('.pantalla');

        botones.forEach(boton => {
            boton.addEventListener('click', () => {
                const targetId = boton.getAttribute('data-target');

                // Remover la clase activo de todos los botones
                botones.forEach(btn => btn.classList.remove('activo'));
                // Agregar la clase activo al botón presionado
                boton.classList.add('activo');

                // Ocultar todas las pantallas
                pantallas.forEach(pantalla => {
                    pantalla.style.display = 'none';
                });

                // Mostrar la pantalla seleccionada
                const pantallaActiva = document.getElementById(targetId);
                if (pantallaActiva) {
                    pantallaActiva.style.display = 'block';
                }
            });
        });