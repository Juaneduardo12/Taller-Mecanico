document.addEventListener("DOMContentLoaded", () => {
    const botonMenu = document.getElementById("botonMenu");
    const menuNav = document.getElementById("menuNav");

    if (botonMenu && menuNav) {
        // Alternar menú móvil
        botonMenu.addEventListener("click", () => {
            botonMenu.classList.toggle("menu-activo");
            menuNav.classList.toggle("menu-abierto");
        });

        // Cerrar menú al hacer clic en un enlace
        menuNav.querySelectorAll("a").forEach(enlace => {
            enlace.addEventListener("click", () => {
                botonMenu.classList.remove("menu-activo");
                menuNav.classList.remove("menu-abierto");
            });
        });

        // Cerrar menú al hacer clic fuera
        document.addEventListener("click", (evento) => {
            if (!menuNav.contains(evento.target) && !botonMenu.contains(evento.target)) {
                botonMenu.classList.remove("menu-activo");
                menuNav.classList.remove("menu-abierto");
            }
        });
    }
});

// Lógica del Carrusel
let indiceActual = 0;
const slides = document.querySelectorAll('.carrusel-slide');

function mostrarSlide(indice) {
    if (slides.length === 0) return;
    slides[indiceActual].classList.remove('activa');
    indiceActual = (indice + slides.length) % slides.length;
    slides[indiceActual].classList.add('activa');
}

function moverCarrusel(direccion) {
    mostrarSlide(indiceActual + direccion);
}