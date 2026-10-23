import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

// Smooth scroll de toute la page (sur #smooth-wrapper)
export default class Scroller {
    constructor(element) {
        this.element = element;
        gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
        this.options = {
            hasPinItems: false,
        };
        this.arrivalDuration = 1.2; // descente à l'arrivée depuis une autre page, en secondes
        this.menuAnchorDuration = 0.8;
        this.smoother = null;

        this.init();
    }

    init() {
        this.moveFixedElements();

        // Au doigt (isTouch 1 = écran tactile sans souris) : scroll natif du téléphone, fluide (120 fps)
        // et sans normalizeScroll. Les data-speed et data-lag sont coupés au doigt, parce que ce sont
        // eux qui sautillaient (jitter) pendant le scroll natif.
        const isTouch = ScrollTrigger.isTouch === 1;

        this.smoother = ScrollSmoother.create({
            smooth: 1, // durée du rattrapage à la souris, en secondes
            effects: !isTouch, // active les data-speed et data-lag (ordinateur seulement)
            smoothTouch: false, // au doigt : pas de lissage, scroll natif
            ease: "expo.out",
        });
        this.initAnchors();
        this.initLoadGuard();
        this.initNavLock();
        this.setOptions(); // après le smoother : les pins en ont besoin
    }

    // PIN CONTROLS
    // Les .js-pinned restent au centre de l'écran pendant le scroll.
    // Options en data-attributs sur l'élément :
    //   data-pin-end="sélecteur"      se relâche quand cet élément arrive au centre
    //   data-pin-overflow="sélecteur" centre aussi ce qui dépasse au-dessus (ex. la tête du portrait)
    initPins() {
        const pinnedItems = this.element.querySelectorAll(".js-pinned");

        for (let i = 0; i < pinnedItems.length; i++) {
            this.createPin(pinnedItems[i]);
        }
    }

    createPin(pinnedItem) {
        const settings = {
            pin: pinnedItem,
            trigger: pinnedItem.parentElement,
            start: "center center",
            end: "80% center",
            //markers: true, // debug : à retirer avant la mise en ligne
        };

        if (pinnedItem.dataset.pinEnd) {
            settings.endTrigger = document.querySelector(pinnedItem.dataset.pinEnd);
            settings.end = "center center";
            settings.pinSpacing = false; // l'emplacement est déjà réservé dans la page
            settings.refreshPriority = -1; // mesuré après les autres pins (ex. ShortStory), qui allongent le trajet
        }

        if (pinnedItem.dataset.pinOverflow) {
            const overflowItem = pinnedItem.querySelector(pinnedItem.dataset.pinOverflow);
            const center = () => `${this.getVisualCenter(pinnedItem, overflowItem)} center`;

            settings.start = center;
            if (settings.endTrigger) settings.end = center;
        }

        ScrollTrigger.create(settings);
    }

    // Milieu entre le haut de ce qui dépasse et le bas de l'élément, depuis le haut du parent
    getVisualCenter(pinnedItem, overflowItem) {
        const parent = pinnedItem.parentElement.getBoundingClientRect();
        const item = pinnedItem.getBoundingClientRect();
        const overflow = overflowItem.getBoundingClientRect();

        const top = Math.min(item.top, overflow.top);
        const middle = (top + item.bottom) / 2 - parent.top;

        return `top+=${Math.round(middle)}`;
    }

    // Au chargement (Précédent, rechargement), la page doit être directement à sa place.
    // Si la page est lente à ce moment-là, ScrollSmoother pouvait repartir de 0 et glisser
    // jusqu'à la bonne position : c'était le « saut ». Tant que le visiteur n'a pas encore
    // touché au scroll (et au plus 3 s après le chargement), on le garde recalé.
    initLoadGuard() {
        this.keepInPlace = this.keepInPlace.bind(this);
        this.stopLoadGuard = this.stopLoadGuard.bind(this);
        gsap.ticker.add(this.keepInPlace);

        const events = ["wheel", "touchstart", "keydown", "pointerdown"];
        for (let i = 0; i < events.length; i++) {
            window.addEventListener(events[i], this.stopLoadGuard, {
                once: true,
                passive: true,
            });
        }
        window.addEventListener("load", () => setTimeout(this.stopLoadGuard, 3000));
    }

    keepInPlace() {
        if (Math.abs(this.smoother.scrollTop() - window.scrollY) > 1) {
            this.smoother.scrollTop(window.scrollY);
        }
    }

    stopLoadGuard() {
        gsap.ticker.remove(this.keepInPlace);
    }

    // Menu mobile ouvert : la page ne scrolle plus derrière.
    // On suit la classe nav-is-active, peu importe qui l'ajoute ou l'enlève.
    initNavLock() {
        const html = document.documentElement;

        const observer = new MutationObserver(() => {
            const isOpen = html.classList.contains("nav-is-active");

            if (this.smoother.paused() !== isOpen) {
                this.smoother.paused(isOpen);
            }
        });

        observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    }

    // Les éléments fixed doivent être hors du wrapper pour rester fixes
    moveFixedElements() {
        const fixedElements = document.querySelectorAll(".js-fixed");

        for (let i = 0; i < fixedElements.length; i++) {
            this.element.before(fixedElements[i]);
        }
    }

    // Les ancres passent par ScrollSmoother au lieu du saut du navigateur
    initAnchors() {
        const links = document.querySelectorAll('a[href*="#"]');

        for (let i = 0; i < links.length; i++) {
            links[i].addEventListener("click", this.onAnchorClick.bind(this));
        }

        // Arrivée depuis une autre page (ex. index.html#projets)
        window.addEventListener("load", this.onLoad.bind(this));

        // Précédent / Suivant entre les sections
        window.addEventListener("hashchange", this.onHashChange.bind(this));
    }

    onAnchorClick(e) {
        const link = e.currentTarget;
        const target = this.getTarget(link.hash);

        if (!target || !this.isSamePage(link)) return;

        e.preventDefault();

        // Met à jour l'URL (#about) sans le saut du navigateur
        if (window.location.hash !== link.hash) {
            history.pushState(null, "", link.hash);
        }

        const nav = this.element.querySelector(".header__nav");
        if (nav && document.documentElement.classList.contains("nav-is-active")) {
            const onNavClose = (event) => {
                if (event.target !== nav || event.propertyName !== "transform") return;

                nav.removeEventListener("transitionend", onNavClose);
                this.scrollToTarget(target, this.menuAnchorDuration);
            };

            nav.addEventListener("transitionend", onNavClose);
            document.documentElement.classList.remove("nav-is-active");
            return;
        }

        this.scrollToTarget(target);
    }

    // Défilement animé jusqu'à une cible (un élément ou 0 pour le haut).
    scrollToTarget(target, duration) {
        if (duration) {
            gsap.to(this.smoother, {
                scrollTop: this.smoother.offset(target, "top top"),
                duration,
                ease: "power2.inOut",
                overwrite: true,
            });
            return;
        }

        this.smoother.scrollTo(target, true, "top top");
    }

    onLoad() {
        const target = this.getTarget(window.location.hash);

        if (!target) return;

        // Arrivée par un lien d'une autre page (ex. contact → Projets) :
        // on part du haut, puis on descend en douceur jusqu'à la section
        if (this.isLinkArrival()) {
            this.stopLoadGuard(); // le garde bloquerait l'animation
            this.element.scrollTop = 0; // annule le saut du navigateur
            this.smoother.scrollTop(0);

            gsap.to(this.smoother, {
                scrollTop: this.smoother.offset(target, "top top"),
                duration: this.arrivalDuration,
                ease: "power2.inOut",
            });
            return;
        }

        // Rechargement ou Précédent / Suivant : directement à la section
        this.smoother.scrollTo(target, false, "top top");
    }

    // true si on arrive par un lien (pas un rechargement, ni Précédent / Suivant)
    isLinkArrival() {
        const navigation = performance.getEntriesByType("navigation")[0];

        return navigation && navigation.type === "navigate";
    }

    // Arrive après le saut du navigateur : on le remplace par le nôtre
    onHashChange() {
        const target = this.getTarget(window.location.hash);

        if (this.element.scrollTop !== 0) {
            this.element.scrollTop = 0;
        }

        this.scrollToTarget(target || 0);
    }

    // L'élément visé par un hash (#about), ou null
    getTarget(hash) {
        return hash ? document.getElementById(hash.slice(1)) : null;
    }

    // "/" et "/index.html" sont la même page
    isSamePage(link) {
        const clean = (path) => path.replace(/index\.html$/, "");

        return clean(link.pathname) === clean(window.location.pathname);
    }

    setOptions() {
        if ("pinItems" in this.element.dataset) {
            this.options.hasPinItems = true;
            this.initPins();
        }
    }
}
