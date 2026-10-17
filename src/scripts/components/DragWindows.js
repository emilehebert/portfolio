// Fenêtres glissables (galerie bureau), position de départ en % : data-x="10" data-y="20"
// Options sur le conteneur : data-draggable, data-open-on-click, data-drag-threshold, data-breakpoint
export default class DragWindows {
    constructor(element) {
        this.element = element;
        this.options = {
            draggable: true, // glisser à la souris
            openOnClick: true, // un clic sans bouger ouvre l'image dans la Modal
            dragThreshold: 5, // en px, au-delà le clic devient un glisser
            breakpoint: 768, // en dessous, les fenêtres s'empilent en colonne
        };

        this.windows = this.element.querySelectorAll(".js-drag-window");
        this.current = null; // fenêtre en cours de glisser
        this.hasMoved = false;
        this.zIndex = this.windows.length;
        this.media = null;

        this.init();
    }

    init() {
        this.setOptions();
        this.setPositions();

        // Souris seulement (pas de tactile) et assez large
        this.media = window.matchMedia(`(min-width: ${this.options.breakpoint}px) and (hover: hover) and (pointer: fine)`);
        this.media.addEventListener("change", this.update.bind(this));
        window.addEventListener("resize", this.clampAll.bind(this));
        this.update();

        // Phase capture : passe avant Modal pour bloquer le clic qui suit un glisser
        this.element.addEventListener("click", this.onClick.bind(this), true);

        for (let i = 0; i < this.windows.length; i++) {
            const win = this.windows[i];
            win.addEventListener("pointerdown", this.onDown.bind(this));
            win.addEventListener("pointermove", this.onMove.bind(this));
            win.addEventListener("pointerup", this.onUp.bind(this));
            win.addEventListener("pointercancel", this.onUp.bind(this));
        }
    }

    // Bureau (fenêtres posées) ou colonne (mobile, tactile)
    update() {
        const isScattered = this.media.matches;
        this.element.classList.toggle("is-scattered", isScattered);
        this.element.classList.toggle("is-draggable", isScattered && this.options.draggable);
        this.clampAll();
    }

    setPositions() {
        for (let i = 0; i < this.windows.length; i++) {
            const win = this.windows[i];
            win.style.left = Number(win.dataset.x || 0) + "%";
            win.style.top = Number(win.dataset.y || 0) + "%";
            win.style.zIndex = i + 1;
        }
    }

    onDown(event) {
        if (!this.element.classList.contains("is-draggable") || event.button !== 0) return;

        const win = event.currentTarget;
        this.current = win;
        this.hasMoved = false;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.startLeft = win.offsetLeft;
        this.startTop = win.offsetTop;

        this.bringToFront(win);
        win.setPointerCapture(event.pointerId);
    }

    onMove(event) {
        if (!this.current) return;

        const x = event.clientX - this.startX;
        const y = event.clientY - this.startY;

        // Sous le seuil, on attend : c'est peut-être juste un clic
        if (!this.hasMoved && Math.hypot(x, y) < this.options.dragThreshold) return;

        this.hasMoved = true;
        this.current.classList.add("is-dragging");
        this.move(this.current, this.startLeft + x, this.startTop + y);
    }

    onUp() {
        if (!this.current) return;

        this.current.classList.remove("is-dragging");
        this.current = null;
    }

    onClick(event) {
        const win = event.target.closest(".js-drag-window");
        if (!win) return;

        // Après un glisser (ou option coupée), la Modal ne reçoit pas le clic
        if (this.hasMoved || !this.options.openOnClick) {
            event.stopPropagation();
            this.hasMoved = false;
        }
    }

    // Garde la fenêtre dans le conteneur, position enregistrée en %
    move(win, left, top) {
        const maxLeft = this.element.clientWidth - win.offsetWidth;
        const maxTop = this.element.clientHeight - win.offsetHeight;

        left = Math.min(Math.max(left, 0), Math.max(maxLeft, 0));
        top = Math.min(Math.max(top, 0), Math.max(maxTop, 0));

        win.style.left = (left / this.element.clientWidth) * 100 + "%";
        win.style.top = (top / this.element.clientHeight) * 100 + "%";
    }

    clampAll() {
        if (!this.element.classList.contains("is-scattered")) return;

        for (let i = 0; i < this.windows.length; i++) {
            const win = this.windows[i];
            this.move(win, win.offsetLeft, win.offsetTop);
        }
    }

    bringToFront(win) {
        this.zIndex++;
        win.style.zIndex = this.zIndex;
    }

    setOptions() {
        if (this.element.dataset.draggable === "false") {
            this.options.draggable = false;
        }

        if (this.element.dataset.openOnClick === "false") {
            this.options.openOnClick = false;
        }

        if (this.element.dataset.dragThreshold) {
            this.options.dragThreshold = Number(this.element.dataset.dragThreshold);
        }

        if (this.element.dataset.breakpoint) {
            this.options.breakpoint = Number(this.element.dataset.breakpoint);
        }
    }
}
