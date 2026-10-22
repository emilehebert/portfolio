import DitherCanvas from "../utils/dither/DitherCanvas.js";
import DitherStill from "../utils/dither/DitherStill.js";
import { getColor } from "../utils/dither/algorithms.js";

// Format mobile : écran tactile sans survol (téléphone, tablette) ou fenêtre étroite ($breakpoint-sm).
// Suivi en direct, pour que le mode responsive passe du dither ordinateur au dither mobile (voir switchMode)
const mobileQuery = window.matchMedia("(hover: none) and (pointer: coarse), (max-width: 768px)");
let isTouch = mobileQuery.matches;

// Fiches de projet seulement : l'image passe en couleur quand elle est au milieu de l'écran
const isProjectPage = !!document.querySelector(".hero--projet");

// Réglages des observers (même méthode que Scrolly : un seul observer pour toutes les images)
const NEAR_MARGIN = isTouch ? "100%" : "25%"; // crée le dither un peu avant que l'image arrive, pour qu'il soit prêt à temps
const CENTER_MARGIN = "-40%"; // bande au milieu de l'écran (40 % en haut et en bas sont ignorés = 20 % au centre)

const veils = new Map(); // élément observé → son DitherVeil
let nearObserver = null;
let centerObserver = null;

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
 * Fiches de projet : quand le CENTRE de l'image est dans la bande du milieu de l'écran,
 * elle reçoit la classe is-active et passe en couleur sans survol
 * (sauf la vignette vidéo flottante, toujours au milieu).
 *
 * Ordinateur : DitherCanvas (WebGL, animé, la couleur revient au survol).
 *              Créé un peu avant que l'image arrive à l'écran, retiré quand elle est loin.
 * Tactile    : DitherStill (canvas 2D, figé). Dessiné une fois, une hauteur d'écran avant, puis gardé.
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
            intro: true, // animation d'apparition des pixels : seulement la 1re fois (voir createDither)
        };
        this.dither = null;
        this.isActive = false; // le centre de l'image est au milieu de l'écran
        this.isNear = false; // l'image est proche de l'écran (watchNear)

        if (!this.image) return;

        this.init();
    }

    init() {
        // Les deux observers sont créés une seule fois, pour toutes les images de la page
        if (!nearObserver) {
            nearObserver = new IntersectionObserver(watchNear, {
                rootMargin: `${NEAR_MARGIN} 0px ${NEAR_MARGIN} 0px`,
            });
            centerObserver = new IntersectionObserver(watchCenter, {
                rootMargin: `${CENTER_MARGIN} 0px ${CENTER_MARGIN} 0px`,
            });
            mobileQuery.addEventListener("change", onMobileChange);
        }

        veils.set(this.element, this);
        nearObserver.observe(this.element);

        if (isProjectPage && !this.element.closest(".video")) {
            // Une ligne invisible au centre de l'image : c'est elle qu'on observe,
            // pour que l'image s'active quand son centre arrive au milieu (pas dès son bord)
            this.center = document.createElement("span");
            this.center.className = "dither-veil__center";
            this.element.appendChild(this.center);

            veils.set(this.center, this);
            centerObserver.observe(this.center);
        }
    }

    setActive(isActive) {
        this.isActive = isActive;

        // Tactile : le dither figé disparaît en fondu (voir dither-veil.scss)
        this.element.classList.toggle("is-active", isActive);
        if (this.dither && !isTouch) this.dither.setRevealed(isActive);
    }

    createDither() {
        if (this.dither) return;

        if (isTouch) {
            this.dither = new DitherStill(this.element, this.image, this.options);
            return;
        }

        const trigger = this.element.dataset.trigger;
        const hoverTarget = (trigger && this.element.closest(trigger)) || this.element;
        this.dither = DitherCanvas.get(this.element, this.image, this.options, hoverTarget);

        if (!this.dither.isSupported) this.dither = null;
        else if (this.isActive) this.dither.setRevealed(true);

        // Le canvas est recréé quand l'image revient à l'écran : on ne rejoue pas l'apparition
        this.options.intro = false;
    }

    // On passe de mobile à ordinateur (ou l'inverse) : on refait le dither avec le bon mode
    switchMode() {
        this.removeDither();
        this.options.pixelSize = isTouch ? 1 : 2;
        this.options.intro = false; // pas d'animation d'apparition, l'image était déjà là
        if (this.isNear) this.createDither();
    }

    removeDither() {
        if (!this.dither) return;
        this.dither.release(); // le canvas WebGL est gardé pour la prochaine image (ordinateur seulement)
        this.dither = null;
    }
}

// Images qui attendent leur dither : une seule par image affichée, pour ne pas tout préparer d'un coup
// (ex. les 3 images d'une étape arrivent en même temps)
const queue = [];
let isQueueRunning = false;

function nextInQueue() {
    const veil = queue.shift();
    if (veil) veil.createDither();

    isQueueRunning = queue.length > 0;
    if (isQueueRunning) requestAnimationFrame(nextInQueue);
}

// Proche de l'écran : on prépare le dither. Loin : on le retire (ordinateur seulement)
function watchNear(entries) {
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const veil = veils.get(entry.target);
        const index = queue.indexOf(veil);
        veil.isNear = entry.isIntersecting;

        if (entry.isIntersecting) {
            if (index < 0) queue.push(veil);
        } else {
            if (index >= 0) queue.splice(index, 1);
            if (!isTouch) veil.removeDither();
        }
    }

    if (!isQueueRunning && queue.length > 0) {
        isQueueRunning = true;
        requestAnimationFrame(nextInQueue);
    }
}

// La fenêtre change de format (mobile ↔ ordinateur) : chaque image change de dither
function onMobileChange() {
    isTouch = mobileQuery.matches;
    new Set(veils.values()).forEach((veil) => veil.switchMode()); // Set : une image peut être dans veils deux fois (avec sa ligne du centre)
}

// Centre de l'image dans la bande du milieu : en couleur
function watchCenter(entries) {
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        veils.get(entry.target).setActive(entry.isIntersecting);
    }
}
