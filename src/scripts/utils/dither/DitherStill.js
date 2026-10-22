import { coverScale, objectPosition } from "./algorithms.js";

// Seuils de la matrice de Bayer 4×4 (mêmes valeurs que bayer4() dans shaders.js)
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/*
 * DitherStill — le dither FIGÉ des écrans tactiles, dessiné en canvas 2D (redessiné seulement si la taille change).
 * Pas de WebGL : sur iPhone, un canvas WebGL par image donnait des images noires
 * et faisait perdre le WebGL du bandeau du footer (Safari limite le nombre de contextes WebGL).
 *
 * En couleur (rouge, vert et bleu ditherés séparément), 1 pixel du canvas = 1 point de dither.
 */
export default class DitherStill {
    constructor(container, image, options) {
        this.container = container; // le .window__media
        this.image = image; // l'<img> de la page
        this.options = options;
        this.canvas = null;

        this.image
            .decode()
            .then(() => {
                if (this.isReleased) return; // retiré avant la fin du chargement
                this.draw();
                // Redessine quand l'image change de taille (rotation, fenêtre redimensionnée), sinon le canvas est étiré
                this.resizeObserver = new ResizeObserver(() => {
                    clearTimeout(this.resizeTimer);
                    this.resizeTimer = setTimeout(() => this.draw(), 150);
                });
                this.resizeObserver.observe(this.container);
            })
            .catch(() => {}); // image brisée : on garde l'<img>
    }

    draw() {
        const { levels, contrast, inkColor, paperColor } = this.options;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (!width || !height) return;
        if (width === this.width && height === this.height) return; // même taille, rien à refaire
        this.width = width;
        this.height = height;

        // Nombre de points sur la largeur et la hauteur
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cell = Math.max(1, Math.round(this.options.pixelSize * dpr));
        const cols = Math.ceil((width * dpr) / cell);
        const rows = Math.ceil((height * dpr) / cell);

        // Un seul canvas par image, réutilisé quand on redessine
        if (!this.canvas) {
            this.canvas = document.createElement("canvas");
            this.canvas.className = "dither-veil__canvas dither-veil__canvas--still";
            this.container.appendChild(this.canvas);
        }
        const canvas = this.canvas;
        canvas.width = cols;
        canvas.height = rows;
        const context = canvas.getContext("2d", { willReadFrequently: true });

        // 1. La photo réduite à 1 pixel par point, cadrée comme object-fit: cover (et son object-position)
        const [coverX, coverY] = coverScale(cols, rows, this.image.naturalWidth, this.image.naturalHeight);
        const drawWidth = cols / coverX;
        const drawHeight = rows / coverY;
        context.imageSmoothingQuality = "high";
        const [alignX, alignY] = objectPosition(this.image);
        context.drawImage(this.image, (cols - drawWidth) * alignX, (rows - drawHeight) * alignY, drawWidth, drawHeight);

        // 2. Chaque canal de chaque point est arrondi à un des `levels` tons, vers le haut ou le bas
        //    selon sa case dans la matrice de Bayer. Puis le ton devient une couleur entre l'encre et le papier.
        const imageData = context.getImageData(0, 0, cols, rows);
        const pixels = imageData.data;
        const steps = levels - 1;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const p = (y * cols + x) * 4;
                const threshold = (BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) / 16;

                for (let c = 0; c < 3; c++) {
                    // Contraste (comme dans le shader), puis arrondi
                    const value = Math.pow(Math.min(1, Math.max(0, (pixels[p + c] / 255 - 0.5) * contrast + 0.5)), 1.6) * steps;
                    const base = Math.floor(value);
                    const level = Math.min(base + (value - base >= threshold ? 1 : 0), steps) / steps;

                    pixels[p + c] = Math.round((inkColor[c] + (paperColor[c] - inkColor[c]) * level) * 255);
                }
                // pixels[p + 3] (la transparence) reste celle de l'image : un PNG transparent le reste
            }
        }

        context.putImageData(imageData, 0, 0);
    }

    // Retire le canvas (ex. la fenêtre repasse en format ordinateur)
    release() {
        this.isReleased = true;
        clearTimeout(this.resizeTimer);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.canvas) this.canvas.remove();
    }
}
