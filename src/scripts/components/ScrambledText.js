import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(SplitText, ScrambleTextPlugin);

/*
 * ScrambledText — les lettres proches du curseur se brouillent, puis se reforment.
 * (Adapté de React Bits « ScrambledText », inspiré de Tom Miller / GSAP.)
 *
 * Utilisation :
 *   <a href="..." data-component="ScrambledText">À propos</a>
 *
 * Depuis un autre composant (ex. IconLabel), on peut choisir l'élément qui réagit au survol :
 *   new ScrambledText(label, link);   → le label se brouille quand on survole le lien
 *
 * Les options ci-dessous s'appliquent à TOUS les textes.
 * Pour changer UN seul texte, ajoute un data-attribut (voir setOptions) :
 *   data-radius="40"   data-duration="0.8"   data-speed="0.5"   data-chars="01"   data-interval="2"   data-once="false"   data-intro="true"
 */
export default class ScrambledText {
  constructor(element, trigger) {
    this.element = element;
    this.trigger = trigger || element; // élément qui réagit au survol (par défaut, le texte lui-même)
    this.options = {
      radius: 100, // distance autour du curseur où les lettres se brouillent, en px
      duration: 1.2, // durée du brouillage d'une lettre, en secondes
      speed: 0.5, // vitesse à laquelle les caractères changent
      chars: 'XxÉéHh.:;,.^', // caractères utilisés pour brouiller
      interval: 1, // temps minimum entre deux brouillages, en secondes
      once: false, // true = un seul brouillage par survol (à l'entrée du curseur)
      intro: false, // true = le texte se brouille la 1re fois qu'il apparaît à l'écran
    };
    this.letters = [];
    this.lastScramble = 0; // moment du dernier brouillage, en ms

    this.init();
  }

  init() {
    this.setOptions();

    // Coupe le texte en une <span class="scrambled-text__char"> par lettre,
    // rangées dans un <span> par mot pour que le texte passe à la ligne entre les mots, pas au milieu
    // aria-label est interdit sur un span ou un label (accessibilité) : on laisse alors les lettres lisibles
    const canHaveLabel = !['SPAN', 'LABEL', 'P', 'DIV'].includes(this.element.tagName);
    const split = SplitText.create(this.element, {
      type: 'words, chars',
      wordsClass: 'scrambled-text__word',
      charsClass: 'scrambled-text__char',
      tag: 'span',
      aria: canHaveLabel ? 'auto' : 'none',
    });
    this.letters = split.chars;

    // Chaque lettre retient son texte d'origine, pour se reformer après le brouillage
    for (let i = 0; i < this.letters.length; i++) {
      const letter = this.letters[i];
      letter.dataset.content = letter.textContent;
    }

    if (this.options.once) {
      this.trigger.addEventListener(
        'pointerenter',
        this.scrambleAll.bind(this),
      );
    } else {
      this.trigger.addEventListener('pointermove', this.onMove.bind(this));
    }

    if (this.options.intro) this.playIntro();
  }

  // Intro : attend que le texte soit à l'écran (sinon le brouillage se joue sans qu'on le voie)
  // et que les polices soient chargées (sinon la largeur figée des lettres serait la mauvaise)
  playIntro() {
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect(); // une seule fois
      document.fonts.ready.then(() => this.scrambleAll(true));
    });
    observer.observe(this.element);
  }

  // Brouille toutes les lettres d'un coup
  scrambleAll(lockWidth) {
    for (let i = 0; i < this.letters.length; i++) {
      this.scramble(this.letters[i], 0, lockWidth);
    }

    if (lockWidth) this.followWidth();
  }

  // Intro : les lettres gardent leur case (pas de CLS), mais on les décale avec translate
  // pour imiter le texte qui s'élargit et rétrécit selon les caractères brouillés
  // (un translate ne compte pas dans le CLS de Lighthouse)
  followWidth() {
    // Bord qui reste fixe quand le texte change de largeur : --scramble-anchor en CSS, sinon text-align
    const style = getComputedStyle(this.element);
    const anchor = style.getPropertyValue('--scramble-anchor').trim() || style.textAlign;

    // Span invisible qui mesure la largeur d'un caractère dans la police du texte
    const ruler = document.createElement('span');
    ruler.style.cssText = 'position: absolute; visibility: hidden; white-space: pre;';
    this.element.appendChild(ruler);
    const widths = {};

    // Lettres rangées par ligne (le texte peut prendre plusieurs lignes)
    const lines = {};
    for (let i = 0; i < this.letters.length; i++) {
      const top = this.letters[i].offsetTop;
      (lines[top] = lines[top] || []).push(this.letters[i]);
    }

    const update = () => {
      Object.values(lines).forEach((letters) => {
        // Écart entre la largeur du caractère affiché et la case figée de chaque lettre
        const gaps = letters.map((letter) => {
          const box = parseFloat(letter.style.width);
          if (!box) return 0; // brouillage fini
          const char = letter.textContent;
          if (widths[char] === undefined) {
            ruler.textContent = char;
            widths[char] = ruler.getBoundingClientRect().width;
          }
          return widths[char] - box;
        });
        const total = gaps.reduce((sum, gap) => sum + gap, 0);

        // Collé à gauche : le texte s'élargit vers la droite, à droite : vers la gauche, centré : des deux côtés
        let x = 0;
        if (anchor === 'right' || anchor === 'end') x = -total;
        if (anchor.includes('center')) x = -total / 2;

        for (let i = 0; i < letters.length; i++) {
          letters[i].style.translate = `${x + gaps[i] / 2}px`; // le caractère est centré dans sa case
          x += gaps[i];
        }
      });
    };

    gsap.ticker.add(update);
    gsap.delayedCall(this.options.duration + 0.1, () => {
      gsap.ticker.remove(update);
      ruler.remove();
      for (let i = 0; i < this.letters.length; i++) {
        this.letters[i].style.translate = '';
      }
    });
  }

  onMove(event) {
    const now = performance.now();
    if (now - this.lastScramble < this.options.interval * 100) return;
    this.lastScramble = now;

    for (let i = 0; i < this.letters.length; i++) {
      const letter = this.letters[i];

      // Distance entre le curseur et le centre de la lettre
      const rect = letter.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);

      if (distance < this.options.radius) {
        this.scramble(letter, distance);
      }
    }
  }

  // Brouille la lettre : plus elle est proche du curseur, plus le brouillage dure
  // lockWidth (intro seulement) : la lettre garde sa case, sinon le titre bouge au chargement (CLS dans Lighthouse).
  // followWidth imite alors le changement de largeur. Au survol, la largeur change vraiment
  // (Lighthouse ne bouge pas la souris, ça ne compte pas dans le score)
  scramble(letter, distance, lockWidth) {
    if (lockWidth) {
      letter.style.width = letter.getBoundingClientRect().width + 'px';
      letter.classList.add('is-scrambling'); // centre le caractère dans sa case (voir scrambled-text.scss)
    } else {
      letter.style.width = '';
      letter.classList.remove('is-scrambling');
    }

    gsap.to(letter, {
      overwrite: true,
      onComplete: () => {
        letter.style.width = '';
        letter.classList.remove('is-scrambling');
      },
      duration: this.options.duration * (1 - distance / this.options.radius),
      scrambleText: {
        text: letter.dataset.content,
        chars: this.options.chars,
        speed: this.options.speed,
      },
      ease: 'none',
    });
  }

  setOptions() {
    if (this.element.dataset.radius) {
      this.options.radius = Number(this.element.dataset.radius);
    }

    if (this.element.dataset.duration) {
      this.options.duration = Number(this.element.dataset.duration);
    }

    if (this.element.dataset.speed) {
      this.options.speed = Number(this.element.dataset.speed);
    }

    if (this.element.dataset.chars) {
      this.options.chars = this.element.dataset.chars;
    }

    if (this.element.dataset.interval) {
      this.options.interval = Number(this.element.dataset.interval);
    }

    if ('once' in this.element.dataset) {
      this.options.once = this.element.dataset.once !== 'false';
    }

    if ('intro' in this.element.dataset) {
      this.options.intro = this.element.dataset.intro !== 'false';
    }
  }
}
