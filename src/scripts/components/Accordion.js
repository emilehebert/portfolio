import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/*
 * Accordion — les contenus s'ouvrent et se ferment avec une animation.
 *
 * Les options ci-dessous s'appliquent à TOUS les accordéons.
 * Pour changer UN seul accordéon, ajoute un data-attribut (voir setOptions) :
 *   data-single-open   data-force-open   data-duration="0.6"
 */
export default class Accordion {
  constructor(element) {
    this.element = element;
    this.options = {
      singleOpen: false,
      forceOpen: false,
      duration: 0.4, // durée de l'ouverture et de la fermeture, en secondes
      ease: 'power2.inOut', // courbe de l'animation
    };

    // Un contenu fermé ne prend aucune place (margin-top = l'espace sous le titre)
    this.closedState = {
      height: 0,
      paddingTop: 0,
      paddingBottom: 0,
      marginTop: 0,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      opacity: 0,
    };

    this.refresh = this.refresh.bind(this);
    this.init();
  }

  init() {
    this.setOptions();
    const items = this.element.querySelectorAll('.accordion-item');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.querySelector('.accordion-title');
      if (!title) continue; // ignore cet item et passe au suivant

      title.addEventListener('click', () => this.click(title));
    }
  }

  click(title) {
    const isOpen = title.classList.contains('is-open');

    if (this.options.singleOpen && this.options.forceOpen && isOpen) return;

    if (this.options.singleOpen) {
      this.closeAll();
      if (!isOpen) this.open(title);
    } else if (isOpen) {
      this.close(title);
    } else {
      this.open(title);
    }
  }

  open(title) {
    const content = title.nextElementSibling;
    this.reset(content);
    title.classList.add('is-open');
    gsap.set(content, { overflow: 'hidden' }); // cache le texte qui dépasse

    // Part d'une hauteur de 0 et grandit jusqu'à sa vraie taille
    gsap.from(content, {
      ...this.closedState,
      duration: this.options.duration,
      ease: this.options.ease,
      clearProps: 'all',
    });
    gsap.ticker.add(this.refresh);
  }

  close(title) {
    const content = title.nextElementSibling;
    this.reset(content);
    title.classList.remove('is-open');
    content.classList.add('is-closing'); // reste visible pendant l'animation
    gsap.set(content, { overflow: 'hidden' });

    gsap.to(content, {
      ...this.closedState,
      duration: this.options.duration,
      ease: this.options.ease,
      onComplete: () => this.reset(content),
    });
    gsap.ticker.add(this.refresh);
  }

  // La page change de hauteur à chaque frame de l'animation : on recalcule le parallax
  // (data-speed) en même temps, sinon il saute à la fin. Appelé par gsap.ticker,
  // donc après le rendu des animations de la frame.
  refresh() {
    ScrollTrigger.refresh();
    ScrollTrigger.update(); // applique tout de suite les positions recalculées

    // Après un refresh, ScrollSmoother décale les data-lag (parfois de toute la hauteur
    // scrollée). On termine leur tween de retard pour qu'ils soient directement à leur place.
    const lagged = document.querySelectorAll('[data-lag]');
    const lagTweens = gsap.getTweensOf(lagged).filter((tween) => tween.vars.y === '+=0');
    lagTweens.forEach((tween) => tween.progress(1));

    // Animation finie (dernier refresh fait) : on arrête
    const contents = this.element.querySelectorAll('.accordion-content');
    if (!gsap.isTweening(contents)) gsap.ticker.remove(this.refresh);
  }

  // Arrête l'animation en cours (si on clique vite) et enlève les styles ajoutés
  reset(content) {
    gsap.killTweensOf(content);
    gsap.set(content, { clearProps: 'all' });
    content.classList.remove('is-closing');
  }

  closeAll() {
    const titles = this.element.querySelectorAll('.accordion-title.is-open');
    for (let i = 0; i < titles.length; i++) {
      this.close(titles[i]);
    }
  }

  setOptions() {
    if ('singleOpen' in this.element.dataset) {
      this.options.singleOpen = true;
    }

    if ('forceOpen' in this.element.dataset) {
      this.options.forceOpen = true;
    }

    if ('duration' in this.element.dataset) {
      this.options.duration = parseFloat(this.element.dataset.duration);
    }
  }
}
