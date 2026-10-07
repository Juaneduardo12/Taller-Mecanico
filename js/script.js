document.addEventListener("DOMContentLoaded", () => {
    const botonMenu = document.getElementById("botonMenu");
    const menuNav = document.getElementById("menuNav");
    const enlacesNav = menuNav.querySelectorAll("a");

    // Función para alternar el menú (abrir/cerrar)
    botonMenu.addEventListener("click", () => {
        botonMenu.classList.toggle("menu-activo");
        menuNav.classList.toggle("menu-abierto");
    });

    // Opcional: Cerrar el menú automáticamente cuando se hace clic en cualquier opción
    enlacesNav.forEach(enlace => {
        enlace.addEventListener("click", () => {
            botonMenu.classList.remove("menu-activo");
            menuNav.classList.remove("menu-abierto");
        });
    });

    // Opcional: Cerrar el menú si se hace clic fuera de él en la pantalla
    document.addEventListener("click", (evento) => {
        const esClickDentroMenu = menuNav.contains(evento.target);
        const esClickBoton = botonMenu.contains(evento.target);

        if (!esClickDentroMenu && !esClickBoton && menuNav.classList.contains("menu-abierto")) {
            botonMenu.classList.remove("menu-activo");
            menuNav.classList.remove("menu-abierto");
        }
    });
});

// Archivo: js/script.js

// Índice actual para saber qué imagen estamos mostrando
let indiceActual = 0;
const slides = document.querySelectorAll('.carrusel-slide');

// Función principal para cambiar de imagen
function mostrarSlide(indice) {
    // Ocultamos la imagen actual
    slides[indiceActual].classList.remove('activa');
    
    // Calculamos el nuevo índice (el % asegura que vuelva al principio o al final)
    indiceActual = (indice + slides.length) % slides.length;
    
    // Mostramos la nueva imagen
    slides[indiceActual].classList.add('activa');
}

// Función que llaman los botones (< >)
function moverCarrusel(direccion) {
    mostrarSlide(indiceActual + direccion);
}

// Opcional: Autoplay (para que cambie solo cada 5 segundos)
/*
setInterval(() => {
    moverCarrusel(1);
}, 5000);
*/