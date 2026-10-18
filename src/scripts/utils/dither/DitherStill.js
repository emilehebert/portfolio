import { KERNELS, hexToRgb, fitScale, diffuse } from './algorithms.js';

const MAX_DPR = 2; // résolution max du dither (plus haut = points plus fins, mais plus lourd)

// Seuils de Bayer (mêmes valeurs que dans shaders.js)
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36,
  14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23,
  61, 29, 53, 21,
];

/*
 * DitherStill — le dither FIGÉ des écrans tactiles, dessiné une seule fois en canvas 2D.
 * Pas de WebGL : sur iPhone, trop de canvas WebGL donnent des carrés noirs
 * et font perdre le WebGL des autres effets (le bandeau du footer).
 *
 * 1 pixel du canvas = 1 point de dither, agrandi en CSS (image-rendering: pixelated).
 */
export default class DitherStill {
  constructor(container, image, options) {
    this.container = container; // le .window__media
    this.image = image; // l'<img> de la page
    this.options = options;
    this.canvas = null;

    this.image
      .decode()
      .then(() => this.draw())
      .catch(() => {}); // image brisée : on garde l'<img>
  }

  draw() {
    const options = this.options;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;

    // Nombre de points sur la largeur et la hauteur
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const cell = Math.max(1, Math.round(options.pixelSize * dpr));
    const cols = Math.ceil((width * dpr) / cell);
    const rows = Math.ceil((height * dpr) / cell);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dither-veil__canvas dither-veil__canvas--still';
    this.canvas.width = cols;
    this.canvas.height = rows;
    const context = this.canvas.getContext('2d', { willReadFrequently: true });

    // Photo réduite à 1 pixel par point, cadrée en 'cover' ou 'contain'
    const ink = hexToRgb(options.inkColor);
    context.fillStyle = `rgb(${ink.map((c) => c * 255).join(',')})`;
    context.fillRect(0, 0, cols, rows);
    context.imageSmoothingQuality = 'high';

    const [coverX, coverY] = fitScale(
      cols,
      rows,
      this.image.naturalWidth,
      this.image.naturalHeight,
      options.fit === 'contain',
    );
    const drawWidth = cols / coverX;
    const drawHeight = rows / coverY;
    context.drawImage(
      this.image,
      (cols - drawWidth) / 2,
      (rows - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );

    const imageData = context.getImageData(0, 0, cols, rows);
    const levels = this.dither(imageData.data, cols, rows);
    this.colorize(imageData.data, levels, ink, hexToRgb(options.paperColor));

    context.putImageData(imageData, 0, 0);
    this.container.appendChild(this.canvas);
  }

  // Ton de chaque point (0 = encre, 255 = papier), en RGBA
  dither(pixels, cols, rows) {
    const options = this.options;
    const rgb = options.palette === 'rgb';
    const levels = Math.max(2, Math.round(options.levels));

    // Contraste et luminosité, comme dans le shader
    const grade = (value) => {
      const graded = (value - 0.5) * options.contrast + 0.5 + options.brightness;
      return Math.pow(Math.min(1, Math.max(0, graded)), 1.6);
    };

    // Floyd / Atkinson
    if (KERNELS[options.pattern]) {
      return diffuse(pixels, cols, rows, KERNELS[options.pattern], levels, rgb, grade);
    }

    // Bayer : chaque point est arrondi vers le haut ou le bas selon sa case dans la matrice
    const out = new Uint8Array(cols * rows * 4);
    const steps = levels - 1;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const p = (y * cols + x) * 4;
        const threshold = this.threshold(x, y);

        const r = grade(pixels[p] / 255);
        const g = grade(pixels[p + 1] / 255);
        const b = grade(pixels[p + 2] / 255);
        const values = rgb ? [r, g, b] : [0.2126 * r + 0.7152 * g + 0.0722 * b];

        for (let c = 0; c < 3; c++) {
          const value = (rgb ? values[c] : values[0]) * steps;
          const base = Math.floor(value);
          const level = Math.min(base + (value - base >= threshold ? 1 : 0), steps);
          out[p + c] = Math.round((level / steps) * 255);
        }
        out[p + 3] = 255;
      }
    }

    return out;
  }

  // Seuil entre 0 et 1 selon la position du point
  threshold(x, y) {
    if (this.options.pattern === 'bayer4') {
      return (BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
    }
    return (BAYER8[(y % 8) * 8 + (x % 8)] + 0.5) / 64;
  }

  // Ton → couleur : encre pour 0, papier pour 255 (par canal, comme le shader)
  colorize(pixels, levels, ink, paper) {
    for (let i = 0; i < pixels.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const level = levels[i + c] / 255;
        pixels[i + c] = Math.round((ink[c] + (paper[c] - ink[c]) * level) * 255);
      }
      pixels[i + 3] = 255;
    }
  }
}
