import ComponentFactory from './ComponentFactory.js';
import Icons from './utils/Icons.js';

class Main {
  constructor() {
    this.init();
  }

  init() {
    document.documentElement.classList.add('has-js');

    // Images sous l'écran : on les lance seulement quand le JS démarre (après le premier affichage)
    document.querySelectorAll('img[data-src]').forEach((img) => {
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
    });

    new ComponentFactory();

    Icons.load();
  }
}
// Safari (iPhone) peut lancer le JS avant que main.css soit chargé : les couleurs (--color-...) seraient vides,
// et le dither des images et les bandeaux halftone sortiraient tout noirs. On attend donc le CSS avant de démarrer.
const css = document.querySelector('link[href*="main.css"]');
if (css && !css.sheet) {
  const start = () => new Main();
  css.addEventListener('load', start, { once: true });
  css.addEventListener('error', start, { once: true }); // CSS introuvable : on démarre quand même (sinon les images ne chargent jamais)
} else new Main();
