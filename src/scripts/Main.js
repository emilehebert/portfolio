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
new Main();
