import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Slider avant/après, la poignée fait un petit aller-retour à l'apparition pour inviter à glisser
// <div class="comparison" data-component="Comparison" data-position="50" data-hint="true">
export default class Comparison {
    constructor(element) {
        this.element = element;
        this.options = {
            position: 25,
            hint: true, // false = pas d'animation d'invitation
            hintAmplitude: 8, // décalage gauche/droite, en %
            hintDuration: 0.6, // durée d'un aller, en secondes
            hintDelay: 0.3,
            hintStart: "top 70%", // quand l'animation part (ScrollTrigger)
        };
        this.isDragging = false;
        this.hint = null;
        this.trigger = null;

        this.init();
    }

    init() {
        this.setOptions();
        this.setPosition(this.options.position);

        this.element.addEventListener("pointerdown", this.onDown.bind(this));
        window.addEventListener("pointermove", this.onMove.bind(this));
        window.addEventListener("pointerup", this.onUp.bind(this));

        if (this.options.hint) this.initHint();
    }

    initHint() {
        // pas d'animation si l'utilisateur préfère réduire les mouvements
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const { position, hintAmplitude, hintDuration } = this.options;
        const proxy = { position: position };

        this.hint = gsap.timeline({
            paused: true,
            defaults: { duration: hintDuration, ease: "sine.inOut" },
            onUpdate: () => this.setPosition(proxy.position),
        });
        this.hint
            .to(proxy, { position: position + hintAmplitude, delay: this.options.hintDelay })
            .to(proxy, { position: position - hintAmplitude, duration: hintDuration * 2 })
            .to(proxy, { position: position });

        // une seule fois, quand le slider entre dans l'écran
        this.trigger = ScrollTrigger.create({
            trigger: this.element,
            start: this.options.hintStart,
            once: true,
            onEnter: () => this.hint && this.hint.play(),
        });
    }

    stopHint() {
        if (!this.hint) return;
        this.hint.kill();
        this.hint = null;
        if (this.trigger) this.trigger.kill();
    }

    onDown(event) {
        this.stopHint(); // l'utilisateur a compris, on arrête pour de bon
        this.isDragging = true;
        this.move(event);
    }

    onMove(event) {
        if (!this.isDragging) return;
        this.move(event);
    }

    onUp() {
        this.isDragging = false;
    }

    move(event) {
        const rect = this.element.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percent = (x / rect.width) * 100;

        this.setPosition(Math.min(100, Math.max(0, percent)));
    }

    setPosition(percent) {
        this.element.style.setProperty("--position", percent + "%");
    }

    setOptions() {
        const data = this.element.dataset;

        if ("position" in data) {
            this.options.position = Number(data.position);
        }

        if (data.hint === "false") {
            this.options.hint = false;
        }

        if (data.hintAmplitude) {
            this.options.hintAmplitude = Number(data.hintAmplitude);
        }

        if (data.hintDuration) {
            this.options.hintDuration = Number(data.hintDuration);
        }

        if (data.hintDelay) {
            this.options.hintDelay = Number(data.hintDelay);
        }

        if (data.hintStart) {
            this.options.hintStart = data.hintStart;
        }
    }
}
