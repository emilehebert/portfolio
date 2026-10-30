import { ScrollTrigger } from "gsap/ScrollTrigger";
import IconLabel from "./IconLabel.js";

/*
 * SocialsDock — bouton « Réseaux » du header qui ouvre une boîte avec les liens des réseaux du footer.
 * Le JS ne fait que mettre des classes, les animations sont des transitions CSS (header.scss) :
 *   html.socials-is-docked   le hero est dépassé : le bloc flottant sort à gauche, le bouton apparaît (page sans hero : toujours là)
 *   .socials-dock.is-active  la boîte est ouverte
 * Ferme au clic ou au toucher ailleurs, quand la souris sort, quand le focus sort, ou avec Échap.
 *
 * Utilisation (voir _partials/_header.html) :
 *   <li><div class="socials-dock" data-component="SocialsDock" data-source=".footer .list-icons" data-trigger=".hero">
 *       <button class="socials-dock__button" aria-expanded="false" aria-controls="socials-dock-panel">...</button>
 *       <div class="socials-dock__panel list-icons" id="socials-dock-panel"></div>
 *   </div></li>
 *
 * Options en data-attributs : data-source=".footer .list-icons"   data-trigger=".hero"   data-start="bottom top"
 */

export default class SocialsDock {
    constructor(element) {
        this.element = element;
        this.options = {
            source: ".footer .list-icons", // bloc de réseaux dont on copie les liens
            trigger: ".hero", // section à dépasser
            start: "bottom top", // le bas de la section arrive en haut de l'écran
        };
        this.isOpen = false;
        this.html = document.documentElement;

        this.init();
    }

    init() {
        this.setOptions();

        this.source = document.querySelector(this.options.source);
        this.trigger = document.querySelector(this.options.trigger);
        if (!this.source) return;

        this.button = this.element.querySelector(".socials-dock__button");
        this.panel = this.element.querySelector(".socials-dock__panel");
        this.fillPanel();

        // Page sans hero : rien à calculer, le CSS affiche déjà le bouton (body:has(.socials-dock):not(:has(.hero)) dans header.scss)
        if (this.trigger) {
            ScrollTrigger.create({
                trigger: this.trigger,
                start: this.options.start,
                end: "max",
                toggleClass: { targets: this.html, className: "socials-is-docked" }, // le CSS fait les transitions
                onLeaveBack: () => this.toggle(false), // retour dans le hero : la boîte se ferme
            });
        }

        this.button.addEventListener("click", () => this.toggle(!this.isOpen));
        this.element.addEventListener("mouseleave", () => this.toggle(false));
        this.element.addEventListener("focusout", (e) => {
            if (e.relatedTarget && !this.element.contains(e.relatedTarget)) this.toggle(false);
        });
        document.addEventListener("pointerdown", (e) => {
            if (!this.element.contains(e.target)) this.toggle(false);
        });
        document.addEventListener("keydown", (e) => {
            if (e.key !== "Escape" || !this.isOpen) return;
            this.toggle(false);
            this.button.focus();
        });
    }

    setOptions() {
        const data = this.element.dataset;

        if ("source" in data) this.options.source = data.source;
        if ("trigger" in data) this.options.trigger = data.trigger;
        if ("start" in data) this.options.start = data.start;
    }

    // Copie les liens du bloc dans la boîte, puis leur ajoute les noms au survol
    fillPanel() {
        const links = this.source.querySelectorAll(".logo--link");

        for (let i = 0; i < links.length; i++) {
            const link = links[i].cloneNode(true);
            const label = link.querySelector(".logo--label");
            if (label) label.remove(); // déjà créé par IconLabel sur le bloc : on en refait un qui marche
            this.panel.appendChild(link);
        }

        new IconLabel(this.panel);
    }

    toggle(isOpen) {
        this.isOpen = isOpen;
        this.element.classList.toggle("is-active", isOpen);
        this.html.classList.toggle("socials-is-open", isOpen); // garde le header affiché (header.scss)
        this.button.setAttribute("aria-expanded", isOpen);
    }
}
