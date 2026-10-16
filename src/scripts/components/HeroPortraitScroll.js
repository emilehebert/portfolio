import { gsap } from 'gsap';

// Mobile = $breakpoint-sm (768px) et moins
const MOBILE = '(max-width: 768px)';

// Portrait du hero. La descente jusqu'à À propos est faite par Scroller.js
// (la fenêtre a la classe .js-pinned).
export default class HeroPortraitScroll {
  constructor(element) {
    this.element = element;
    this.image = this.element.querySelector('.hero__media img');

    if (!this.image) return;

    this.mediaQueries = gsap.matchMedia();

    // Mobile : dans la photo, la tête est ~7 % à gauche du centre.
    // Fait avec GSAP en % : un décalage CSS serait figé en px par data-lag au
    // chargement, souvent avant que la photo arrive (0px sur un vrai téléphone).
    this.mediaQueries.add(MOBILE, () => {
      gsap.set(this.image, { xPercent: 7 });
    });
  }
}
