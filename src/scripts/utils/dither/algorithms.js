/*
 * Petites fonctions partagées par le dither (DitherCanvas, DitherStill) et le bandeau (HalftoneMarquee).
 */

// '--color-primary' (variable de colors.scss) ou '#fb3640' → [r, g, b] entre 0 et 1 (le format des shaders)
export function getColor(color) {
    if (color.startsWith("--")) {
        color = getComputedStyle(document.documentElement).getPropertyValue(color).trim();
    }

    let hex = color.replace("#", "");
    if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c); // '#fff' → 'ffffff'
    const n = parseInt(hex, 16);
    if (Number.isNaN(n)) return [0, 0, 0];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Échelle pour que l'image remplisse le canvas sans être déformée (comme object-fit: cover)
export function coverScale(width, height, imageWidth, imageHeight) {
    const ratio = width / height / (imageWidth / imageHeight);
    return ratio > 1 ? [1, 1 / ratio] : [ratio, 1];
}

// object-position de l'<img> (ex. 'top' → [0.5, 0]) : quelle partie de la photo on garde quand elle est recadrée
export function objectPosition(image) {
    const [x, y] = getComputedStyle(image).objectPosition.split(" ").map(parseFloat);
    return [Number.isNaN(x) ? 0.5 : x / 100, Number.isNaN(y) ? 0.5 : y / 100];
}
