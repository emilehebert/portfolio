import DitherCanvas from "../utils/dither/DitherCanvas.js";
import DitherStill from "../utils/dither/DitherStill.js";
import { getColor } from "../utils/dither/algorithms.js";

// Écran tactile sans survol (téléphone, tablette)
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

/*
 * DitherVeil — met une image en dither (effet de trame de points).
 *
 * Utilisation :
 *   <div class="window__media" data-component="DitherVeil" data-reveal="full" data-trigger=".card">
 *       <img src="..." alt="..." />
 *   </div>
 *
 *   data-reveal="full"     le survol révèle toute l'image en couleur (sinon : seulement autour du curseur)
 *   data-trigger=".card"   le survol de ce parent déclenche l'effet (sinon : l'image elle-même)
 *
 * Ordinateur : DitherCanvas (WebGL, animé, la couleur revient au survol).
 *              Créé quand l'image arrive à l'écran, retiré quand elle en sort.
 * Tactile    : DitherStill (canvas 2D, figé, en couleur). Dessiné une fois, un peu avant
 *              que l'image arrive à l'écran, puis gardé.
 */
export default class DitherVeil {
    constructor(element) {
        this.element = element;
        this.image = this.element.querySelector("img");
        this.options = {
            reveal: this.element.dataset.reveal || "cursor",
            pixelSize: isTouch ? 1 : 2, // taille d'un point de dither, en px CSS
            levels: 7, // nombre de tons
            contrast: 1.15,
            inkColor: getColor("--color-background"), // couleur des tons sombres
            paperColor: getColor("--color-white"), // couleur des tons clairs
        };
        this.dither = null;

        if (!this.image) return;

        // Tactile : on commence une hauteur d'écran avant (100 %) pour que le dither soit prêt à temps
        const margin = isTouch ? "100%" : "0px";
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

        if (isTouch) {
            this.dither = new DitherStill(this.element, this.image, this.options);
            return;
        }

        const trigger = this.element.dataset.trigger;
        const hoverTarget = (trigger && this.element.closest(trigger)) || this.element;
        this.dither = new DitherCanvas(this.element, this.image, this.options, hoverTarget);

        if (!this.dither.isSupported) this.dither = null;
    }

    removeDither() {
        if (!this.dither) return;
        this.dither.destroy();
        this.dither = null;
    }
}
