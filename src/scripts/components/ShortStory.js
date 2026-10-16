import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/*
 * ShortStory — scrollytelling : la section reste à l'écran pendant le scroll
 * et ses étapes (.js-story-step) apparaissent une après l'autre.
 *
 * Utilisation :
 *   <section class="short-story" data-component="ShortStory">
 *     <div class="wrapper">
 *       <h2 class="short-story__step js-story-step">Première phrase</h2>
 *       <h2 class="short-story__step js-story-step">Deuxième phrase</h2>
 *     </div>
 *   </section>
 *
 * Les options ci-dessous s'appliquent à TOUTES les histoires.
 * Pour changer UNE seule histoire, ajoute un data-attribut (voir setOptions) :
 *   data-length="4000"   data-fade="0.5"   data-hold="2"
 */
export default class ShortStory {
  constructor(element) {
    this.element = element;
    this.steps = this.element.querySelectorAll('.js-story-step');
    this.options = {
      length: 3000, // durée de toute l'histoire, en px de scroll
      fade: 1, // durée d'un fondu (apparition ou disparition)
      hold: 1, // temps où une étape reste visible
    };

    this.init();
  }

  init() {
    this.setOptions();

    // Les étapes partent invisibles
    gsap.set(this.steps, { opacity: 0 });

    // fade et hold sont des proportions : la timeline est étirée sur length
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: this.element,
        start: 'top top',
        end: `+=${this.options.length}`,
        scrub: true, // l'animation suit le scroll (et recule si on remonte)
        pin: true, // la section reste à l'écran pendant l'histoire
      },
    });

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const isLast = i === this.steps.length - 1;

      timeline.to(step, { opacity: 1, duration: this.options.fade }); // apparaît
      timeline.to(step, { duration: this.options.hold }); // reste visible

      // La dernière étape reste affichée jusqu'à la fin
      if (!isLast) {
        timeline.to(step, { opacity: 0, duration: this.options.fade }); // disparaît
      }
    }
  }

  setOptions() {
    if (this.element.dataset.length)
      this.options.length = Number(this.element.dataset.length);
    if (this.element.dataset.fade)
      this.options.fade = Number(this.element.dataset.fade);
    if (this.element.dataset.hold)
      this.options.hold = Number(this.element.dataset.hold);
  }
}
