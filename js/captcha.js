// =========================================
// VERIFICACIÓN ANTI-ROBOTS (Cloudflare Turnstile)
//
// Cada página que la use necesita, en este orden:
//   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
//   <script src="js/captcha.js"></script>
//   y un contenedor: <div class="captcha-contenedor" id="miCaptcha"></div>
//
// Uso:  const captcha = await Captcha.montar('#miCaptcha');
//       captcha.token()      -> texto de verificación ('' si aún no termina)
//       captcha.reiniciar()  -> pide una verificación nueva (cada token sirve una sola vez)
// =========================================

// CLAVE PÚBLICA (Site Key) de Turnstile.
// La que está aquí es una clave de PRUEBA de Cloudflare: siempre aprueba, sirve para
// probar en tu computadora. ANTES DE PUBLICAR cámbiala por la tuya (ver instrucciones).
const TURNSTILE_SITE_KEY = '1x00000000000000000000AA';

const Captcha = (function () {
    function esperarTurnstile(maximoMs) {
        return new Promise((resolver, rechazar) => {
            const inicio = Date.now();
            (function revisar() {
                if (window.turnstile) {
                    resolver(window.turnstile);
                } else if (Date.now() - inicio > maximoMs) {
                    rechazar(new Error('Turnstile no cargó'));
                } else {
                    setTimeout(revisar, 150);
                }
            })();
        });
    }

    async function montar(selector) {
        const turnstile = await esperarTurnstile(10000);
        let token = '';

        const id = turnstile.render(selector, {
            sitekey: TURNSTILE_SITE_KEY,
            theme: 'dark',
            size: 'flexible',
            callback: (valor) => { token = valor; },
            'expired-callback': () => { token = ''; },
            'error-callback': () => { token = ''; }
        });

        return {
            token: () => token,
            reiniciar: () => {
                token = '';
                turnstile.reset(id);
            }
        };
    }

    return { montar };
})();
