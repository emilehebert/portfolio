import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/*
 * ScrollStack — les images de chaque étape s'empilent pendant le scroll :
 * l'étape reste à l'écran et chaque image monte se poser sur la précédente.
 *
 * Utilisation :
 *   <div class="etapes" data-component="ScrollStack">
 *     <div class="etape">
 *       <div class="etape__content">...</div>
 *       <div class="etape__media">
 *         <div class="window">...</div>
 *         <div class="window">...</div>
 *       </div>
 *     </div>
 *   </div>
 *
 * Les options ci-dessous s'appliquent à TOUTES les pages.
 * Pour changer UNE seule page, ajoute un data-attribut sur .etapes (voir setOptions) :
 *   data-distance="500"   data-offset="30"   data-scale="0.08"   data-dim="0.3"   data-hold="300"
 */
export default class ScrollStack {
    constructor(element) {
        this.element = element;
        this.steps = this.element.querySelectorAll(".etape");
        this.options = {
            distance: 400, // scroll pour qu'une image se pose, en px
            offset: 24, // décalage entre les images empilées, en px
            scale: 0.05, // rétrécissement d'une image par image posée dessus
            dim: 0.2, // assombrissement d'une image par image posée dessus (0 à 1)
            hold: 200, // scroll où la pile finie reste à l'écran, en px
        };

        this.init();
    }

    init() {
        this.setOptions();

        for (let i = 0; i < this.steps.length; i++) {
            this.createStack(this.steps[i]);
        }
    }

    createStack(step) {
        const cards = step.querySelectorAll(".etape__media > .window");
        if (cards.length < 2) return;

        const { distance, offset, scale, dim, hold } = this.options;

        // Le haut de l'image reste en place quand elle rétrécit
        gsap.set(cards, { transformOrigin: "50% 0%", filter: "brightness(1)" });

        const timeline = gsap.timeline({
            scrollTrigger: {
                trigger: step,
                start: "center center",
                end: `+=${(cards.length - 1) * distance + hold}`,
                scrub: true, // l'animation suit le scroll (et recule si on remonte)
                pin: true, // l'étape reste à l'écran pendant la pile
                pinSpacing: true, // forcé : .etapes est en flex, GSAP le désactive sinon
                invalidateOnRefresh: true, // recalcule la hauteur de l'écran au resize
            },
        });

        for (let i = 1; i < cards.length; i++) {
            // L'image monte depuis le bas de l'écran
            timeline.fromTo(cards[i], { y: () => window.innerHeight }, { y: i * offset, duration: 1, ease: "none" }, i - 1);

            // Les images en dessous rétrécissent et s'assombrissent
            for (let j = 0; j < i; j++) {
                const depth = i - j;
                timeline.to(
                    cards[j],
                    {
                        scale: 1 - depth * scale,
                        filter: `brightness(${Math.pow(1 - dim, depth)})`,
                        duration: 1,
                        ease: "none",
                    },
                    i - 1,
                );
            }
        }

        // La pile finie reste à l'écran un moment
        timeline.to({}, { duration: hold / distance });
    }

    setOptions() {
        if (this.element.dataset.distance) this.options.distance = Number(this.element.dataset.distance);
        if (this.element.dataset.offset) this.options.offset = Number(this.element.dataset.offset);
        if (this.element.dataset.scale) this.options.scale = Number(this.element.dataset.scale);
        if (this.element.dataset.dim) this.options.dim = Number(this.element.dataset.dim);
        if (this.element.dataset.hold) this.options.hold = Number(this.element.dataset.hold);
    }
}
