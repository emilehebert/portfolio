import { ScrollSmoother } from "gsap/ScrollSmoother";
import Comparison from "./Comparison.js";

// Modale unique : s'ouvre avec les liens data-modal="video", "image" ou "comparison"
// La valeur de data-modal choisit le contenu affiché (classe modal--video, modal--image ou modal--comparison)
export default class Modal {
    constructor(element) {
        this.element = element;

        this.links = document.querySelectorAll("[data-modal]");
        this.closeLink = this.element.querySelector(".js-close");
        this.title = this.element.querySelector(".js-modal-title");

        this.init();
    }

    init() {
        // Sur mobile, la vidéo est un simple lien vers YouTube au lieu de la modale
        const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
        const videoId = this.element.querySelector("[data-video-id]").dataset.videoId;

        for (let i = 0; i < this.links.length; i++) {
            const link = this.links[i];

            if (isTouch && link.dataset.modal === "video") {
                link.href = `https://www.youtube.com/watch?v=${videoId}`;
                link.target = "_blank";
                link.addEventListener("click", this.onVideoLinkClick.bind(this));
                continue;
            }

            link.addEventListener("click", this.open.bind(this));
        }

        // Moment où on revient sur la page (ex: on ferme l'onglet YouTube)
        this.visibleAt = 0;
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) this.visibleAt = Date.now();
        });

        this.closeLink.addEventListener("click", this.close.bind(this));
        this.element.addEventListener("click", this.onClickOutside.bind(this));
    }

    open(event) {
        event.preventDefault();
        const link = event.currentTarget;
        const type = link.dataset.modal; // "video", "image" ou "comparison"

        // Affiche le bon contenu, le CSS cache les autres
        this.element.classList.toggle("modal--video", type === "video");
        this.element.classList.toggle("modal--image", type === "image");
        this.element.classList.toggle("modal--comparison", type === "comparison");

        if (type === "image") {
            this.showImage(link);
        } else if (type === "comparison") {
            this.showComparison(link);
        } else {
            this.title.textContent = link.dataset.title || "";
        }

        this.element.classList.add("is-open");
        ScrollSmoother.get().paused(true);
    }

    // Le mode responsive de Chrome rejoue le clic quand on revient sur la page,
    // ce qui rouvrait YouTube. On ignore un clic qui arrive juste au retour.
    onVideoLinkClick(event) {
        if (Date.now() - this.visibleAt < 1000) {
            event.preventDefault();
        }
    }

    close(event) {
        event.preventDefault();
        this.element.classList.remove("is-open");
        ScrollSmoother.get().paused(false);
    }

    // Modale image : copie l'image cliquée et le titre de sa fenêtre dans la modale
    showImage(link) {
        const image = this.element.querySelector(".js-modal-image");
        const source = link.querySelector("img");
        if (!image || !source) return;

        image.src = source.currentSrc || source.src;
        image.alt = source.alt;

        const name = link.querySelector(".window__header p");
        this.title.textContent = name ? name.textContent : source.alt;
    }

    // Modale comparatif : copie le comparatif avant/après de la même fenêtre, en plus grand
    showComparison(link) {
        const window = link.closest(".window");
        const source = window.querySelector(".comparison");
        const container = this.element.querySelector(".js-modal-comparison");
        if (!source || !container) return;

        // Même comparatif que la dernière fois : on garde celui déjà créé
        if (this.comparisonSource !== source) {
            this.comparisonSource = source;
            const clone = source.cloneNode(true);
            container.replaceChildren(clone);
            new Comparison(clone);
        }

        const name = window.querySelector(".window__footer p");
        this.title.textContent = name ? name.textContent : "";
    }

    // Ferme si on clique à côté de la fenêtre
    onClickOutside(event) {
        if (event.target === this.element) {
            this.close(event);
        }
    }
}
