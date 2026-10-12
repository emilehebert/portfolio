import DitherCanvas from '../utils/dither/DitherCanvas.js';

const isTouch = window.matchMedia(
  '(hover: none) and (pointer: coarse)',
).matches;

export default class DitherVeil {
  constructor(element) {
    this.element = element;
    this.image = this.element.querySelector('img');
    this.options = {
      fit: 'cover',
      pattern: 'bayer4',
      palette: 'duotone',
      pixelSize: 2,
      levels: 7,
      contrast: 1.15,
      brightness: 0,
      inkColor: '--color-background',
      paperColor: '--color-white',
      rimColor: '--color-primary',
      trigger: '',
      reveal: 'cursor',
      revealRadius: 300,
      softness: 0.4,
      linger: 1,
      rim: 0,
      reverse: false,
    };
    this.dither = null;

    this.init();
  }

  init() {
    if (!this.image) return;

    this.setOptions();
    this.setColors();

    // 1. On attend que l'image soit prête avant de lancer l'observateur.
    this.waitForImage()
      .then(() => {
        this.initObserver();
      })
      .catch((err) => {
        console.warn('Erreur chargement image DitherVeil:', err);
        // On initialise quand même au cas où c'est un problème de cache bizarre,
        // mais le canvas risque d'être vide.
        this.initObserver();
      });
  }

  // Utilitaire pour s'assurer que l'image est décodée en mémoire
  waitForImage() {
    return new Promise((resolve, reject) => {
      if (this.image.complete) {
        // L'image est dans le cache
        // Optionnel : this.image.decode() permet de forcer le décodage asynchrone
        if (this.image.decode) {
          this.image
            .decode()
            .then(resolve)
            .catch(() => resolve()); // On resolve même si erreur decode
        } else {
          resolve();
        }
      } else {
        // On attend le chargement réseau
        this.image.addEventListener(
          'load',
          () => {
            // Pareil, on force le décodage si possible pour éviter les lags
            if (this.image.decode) {
              this.image
                .decode()
                .then(resolve)
                .catch(() => resolve());
            } else {
              resolve();
            }
          },
          { once: true },
        );
        this.image.addEventListener('error', reject, { once: true });
      }
    });
  }

  initObserver() {
    const margin = isTouch ? '100%' : '0px';
    const observer = new IntersectionObserver(this.watch.bind(this), {
      rootMargin: `${margin} 0px ${margin} 0px`,
    });
    observer.observe(this.element);
  }

  watch(entries) {
    if (entries[0].isIntersecting) {
      this.createDither();
    } else if (!isTouch) {
      this.removeDither();
    }
  }

  createDither() {
    if (this.dither) return;

    let hoverTarget = this.element;
    if (this.options.trigger) {
      hoverTarget = this.element.closest(this.options.trigger) || this.element;
    }

    this.options.frozen = false;

    // Le canvas est créé SEULEMENT quand l'image est garantie chargée
    this.dither = new DitherCanvas(
      this.element,
      this.image,
      this.options,
      hoverTarget,
    );

    if (!this.dither.isSupported) this.dither = null;
  }

  removeDither() {
    if (!this.dither) return;
    this.dither.destroy();
    this.dither = null;
  }

  setColors() {
    this.options.inkColor = this.getColor(this.options.inkColor);
    this.options.paperColor = this.getColor(this.options.paperColor);
    this.options.rimColor = this.getColor(this.options.rimColor);
  }

  getColor(color) {
    if (!color.startsWith('--')) return color;
    return getComputedStyle(document.documentElement)
      .getPropertyValue(color)
      .trim();
  }

  setOptions() {
    // ... [Ton code setOptions original reste identique] ...
    if (this.element.dataset.fit) {
      this.options.fit = this.element.dataset.fit;
    }
    if (this.element.dataset.pattern) {
      this.options.pattern = this.element.dataset.pattern;
    }
    if (this.element.dataset.palette) {
      this.options.palette = this.element.dataset.palette;
    }
    if (this.element.dataset.pixelSize) {
      this.options.pixelSize = Number(this.element.dataset.pixelSize);
    }
    if (this.element.dataset.levels) {
      this.options.levels = Number(this.element.dataset.levels);
    }
    if (this.element.dataset.contrast) {
      this.options.contrast = Number(this.element.dataset.contrast);
    }
    if (this.element.dataset.brightness) {
      this.options.brightness = Number(this.element.dataset.brightness);
    }
    if (this.element.dataset.trigger) {
      this.options.trigger = this.element.dataset.trigger;
    }
    if (this.element.dataset.reveal) {
      this.options.reveal = this.element.dataset.reveal;
    }
    if (this.element.dataset.revealRadius) {
      this.options.revealRadius = Number(this.element.dataset.revealRadius);
    }
    if ('reverse' in this.element.dataset) {
      this.options.reverse = true;
    }
  }
}
