// =========================================
// LISTA DE USUARIOS PARA EL SELECTOR DEL LOGIN
// Cada correo debe ser EXACTAMENTE el que creaste en Supabase.
// Aquí NO van contraseñas.
// =========================================
const USUARIOS_TALLER = [
    { nombre: 'Juan Eduardo Ocampo Castillo', puesto: 'Director General',       correo: 'juaneduardoocampocastillo5@gmail.com' },
    { nombre: 'Luis Joaquin Landa',           puesto: 'Gerente de Operaciones', correo: 'luisjoaquin@gmail.com' },
    { nombre: 'Eduardo Harrison',             puesto: 'Gerente Técnico',        correo: 'eduardoharrison@gmail.com' },
    { nombre: 'Marcus Ostos',                 puesto: 'Gerente de Innovación',  correo: 'marcusostos@gmail.com' },
    { nombre: 'Roman Gutierrez',              puesto: 'Sup. Diagnóstico',       correo: 'romangutierrez@gmail.com' },
    { nombre: 'Emiliano',                     puesto: 'Sup. Mecánica',          correo: 'emiliano@gmail.com' },
    { nombre: 'Fernanda',                     puesto: 'Especialista IA',        correo: 'fernanda@gmail.com' },
    { nombre: 'Fani',                         puesto: 'Atención al Cliente',    correo: 'fani@gmail.com' },
    { nombre: 'Ismael Flores Flores',         puesto: 'Mecánico A',             correo: 'ismaelflores@gmail.com' },
    { nombre: 'Nikolas Giles',                puesto: 'Logística',              correo: 'nikolasgiles@gmail.com' },
    { nombre: 'Eros Tapia',                   puesto: 'Mecánico B',             correo: 'erostapia@gmail.com' },
    { nombre: 'Enrrique Becerril',            puesto: 'Sistemas',               correo: 'enriquebeserril@gmail.com' },
    { nombre: 'Eder',                         puesto: 'Electricista',           correo: 'eder@gmail.com' }
];

document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('correo');
    const campoContrasena = document.getElementById('contrasena');
    if (!selector) return;

    // Llena el selector con los usuarios
    USUARIOS_TALLER.forEach((usuario) => {
        const opcion = document.createElement('option');
        opcion.value = usuario.correo;
        opcion.textContent = usuario.nombre + ' — ' + usuario.puesto;
        selector.appendChild(opcion);
    });

    // Al elegir usuario, el cursor pasa directo a la contraseña
    selector.addEventListener('change', () => {
        if (selector.value && campoContrasena) campoContrasena.focus();
    });
});
