import { Renderer, Program, Mesh, Triangle, Texture, RenderTarget } from "ogl";
import { VERTEX, MASK_FRAGMENT, VIEW_FRAGMENT } from "./shaders.js";
import { coverScale } from "./algorithms.js";

const REVEAL_RADIUS = 300; // rayon de la zone révélée autour du curseur, en px
const SOFTNESS = 0.4; // largeur du bord adouci de la zone révélée (0 → 1)
const LINGER = 1; // temps que met la traînée à s'effacer, en secondes
const HOLD = 1.6; // garde la zone révélée bien pleine avant qu'elle commence à s'effacer
const MASK_SCALE = 0.5; // le masque du curseur est dessiné à demi-résolution (plus rapide)
const INTRO_DURATION = 1100; // durée de l'apparition au chargement, en ms
const POOL_SIZE = 6; // nombre de canvas gardés de côté pour être réutilisés (Chrome en permet 16 en tout)

// Canvas qui ne sont plus à l'écran, prêts à servir pour la prochaine image.
// Créer un canvas WebGL (contexte + shaders) fige le scroll un instant : on les recycle au lieu d'en recréer.
const pool = [];

/*
 * DitherCanvas — le <canvas> WebGL qui affiche UNE image en dither (ordinateur seulement).
 * DitherVeil le prend avec DitherCanvas.get() et le rend avec release().
 *
 *   get()      réutilise un canvas libre (ou en crée un), puis l'attache à l'image
 *   render()   boucle d'animation : bouge le pinceau, dessine le masque, puis l'image
 *   release()  détache le canvas et le garde pour la prochaine image
 *   destroy()  retire le canvas et libère la carte graphique
 *
 * Le « masque » est une image invisible qui retient où le curseur est passé.
 * Là où il est allumé, on montre la photo en couleur au lieu du dither.
 */
export default class DitherCanvas {
    static get(container, image, options, hoverTarget) {
        const dither = pool.pop() || new DitherCanvas();
        if (dither.isSupported) dither.attach(container, image, options, hoverTarget);
        return dither;
    }

    constructor() {
        this.isSupported = false; // reste false si le navigateur n'a pas WebGL2
        this.isDestroyed = false;
        this.isAttached = false;

        // Liées à this une seule fois, pour pouvoir retirer les écouteurs dans release()
        this.onMove = this.onMove.bind(this);
        this.onLeave = this.onLeave.bind(this);
        this.onResize = this.onResize.bind(this);
        this.render = this.render.bind(this);
        this.destroy = this.destroy.bind(this);

        // Création une seule fois par canvas : contexte, textures, shaders
        if (!this.createRenderer()) return;
        this.isSupported = true;

        this.createTextures();
        this.createShaders();

        // Si le navigateur retire le contexte WebGL (trop d'images), on rend la place à l'<img>
        this.canvas.addEventListener("webglcontextlost", this.destroy);
        this.resizeObserver = new ResizeObserver(this.onResize);
    }

    // Attache le canvas à une image (nouvelle ou recyclée)
    attach(container, image, options, hoverTarget) {
        this.container = container; // le .window__media
        this.domImage = image; // l'<img> de la page
        this.options = options;
        this.playIntro = options.intro !== false; // lu tout de suite : DitherVeil le remet à false juste après
        this.hoverTarget = hoverTarget; // l'élément qui réagit au survol
        this.isAttached = true;

        this.image = null; // la photo, une fois chargée
        this.source = null; // la photo réduite à la taille du canvas
        this.width = 1; // taille du canvas, en px CSS
        this.height = 1;

        // Animation
        this.raf = 0; // id du requestAnimationFrame en cours (0 = boucle arrêtée)
        this.lastTime = 0;
        this.introStart = 0;
        this.trailEnd = 0; // moment où la traînée aura fini de s'effacer

        // Curseur et pinceau (le pinceau suit le curseur avec un petit retard)
        this.pointer = { x: 0, y: 0, isInside: false };
        this.brush = { x: 0, y: 0, prevX: 0, prevY: 0 };
        this.presence = 0; // 0 → 1 : à quel point le curseur est « dedans »
        this.isRevealed = false; // true : toute l'image en couleur sans survol (voir setRevealed)

        // Taille d'un point de dither, en pixels réels de l'écran, et réglages des tons
        this.cell = Math.max(1, Math.round(options.pixelSize * this.renderer.dpr));
        this.viewUniforms.uCell.value = this.cell;
        this.viewUniforms.uLevels.value = options.levels;
        this.viewUniforms.uContrast.value = options.contrast;
        this.viewUniforms.uInk.value = options.inkColor;
        this.viewUniforms.uPaper.value = options.paperColor;

        // Efface la traînée de l'image précédente à la 1re image dessinée (voir drawMask)
        this.clearMask = true;

        this.container.appendChild(this.canvas);
        this.loadImage();

        this.hoverTarget.addEventListener("pointerenter", this.onMove);
        this.hoverTarget.addEventListener("pointermove", this.onMove);
        this.hoverTarget.addEventListener("pointerdown", this.onMove);
        this.hoverTarget.addEventListener("pointerleave", this.onLeave);
        this.hoverTarget.addEventListener("pointercancel", this.onLeave);

        // Recalcule la taille du canvas quand la fenêtre change de taille
        this.resizeObserver.observe(this.container);
        this.onResize();
    }

    /*
     Création
     ========================================================================== */

    // Crée le canvas WebGL2 et l'ajoute dans le .window__media. Retourne false si impossible.
    createRenderer() {
        try {
            this.renderer = new Renderer({
                dpr: Math.min(window.devicePixelRatio || 1, 2),
                alpha: true, // les PNG transparents laissent voir le fond de la fenêtre
                premultipliedAlpha: true,
                antialias: false,
            });
        } catch {
            return false;
        }

        this.gl = this.renderer.gl;
        if (!this.gl || !this.renderer.isWebgl2) {
            this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
            return false;
        }

        this.canvas = this.gl.canvas;
        this.canvas.classList.add("dither-veil__canvas");

        // Masque en haute précision si possible (traînée plus douce)
        this.hasFloatMask = !!this.renderer.getExtension("EXT_color_buffer_float");

        return true;
    }

    createTextures() {
        const gl = this.gl;

        // La photo
        this.imageTexture = new Texture(gl, {
            minFilter: gl.LINEAR_MIPMAP_LINEAR,
            magFilter: gl.LINEAR,
            premultiplyAlpha: true, // évite un contour noir autour des zones transparentes
        });

        // Deux masques : on lit le précédent et on dessine le nouveau, puis on les échange
        this.masks = [this.createMask(2, 2), this.createMask(2, 2)];
    }

    createMask(width, height) {
        const gl = this.gl;

        return new RenderTarget(gl, {
            width: width,
            height: height,
            depth: false,
            type: this.hasFloatMask ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
            internalFormat: this.hasFloatMask ? gl.RGBA16F : gl.RGBA,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
        });
    }

    deleteMask(mask) {
        this.gl.deleteFramebuffer(mask.buffer);
        this.gl.deleteTexture(mask.texture.texture);
    }

    // Les « uniforms » sont les valeurs envoyées aux shaders (voir shaders.js)
    createShaders() {
        const gl = this.gl;
        const geometry = new Triangle(gl);

        this.maskUniforms = {
            tPrev: { value: this.masks[0].texture },
            uSize: { value: [1, 1] },
            uFrom: { value: [0, 0] },
            uTo: { value: [0, 0] },
            uRadius: { value: 1 },
            uSoftness: { value: SOFTNESS },
            uStrength: { value: 0 },
            uFade: { value: 1 },
            uHold: { value: HOLD },
        };

        this.viewUniforms = {
            tImage: { value: this.imageTexture },
            tMask: { value: this.masks[0].texture },
            uResolution: { value: [1, 1] },
            uCover: { value: [1, 1] },
            uLod: { value: 0 },
            // Réglages de l'image : remplis dans attach()
            uCell: { value: 1 },
            uLevels: { value: 2 },
            uContrast: { value: 1 },
            uInk: { value: [0, 0, 0] },
            uPaper: { value: [1, 1, 1] },
            uIntro: { value: 0 },
            uHold: { value: HOLD },
        };

        const maskProgram = new Program(gl, {
            vertex: VERTEX,
            fragment: MASK_FRAGMENT,
            uniforms: this.maskUniforms,
            depthTest: false,
            depthWrite: false,
        });

        const viewProgram = new Program(gl, {
            vertex: VERTEX,
            fragment: VIEW_FRAGMENT,
            uniforms: this.viewUniforms,
            depthTest: false,
            depthWrite: false,
        });

        this.maskMesh = new Mesh(gl, { geometry, program: maskProgram });
        this.viewMesh = new Mesh(gl, { geometry, program: viewProgram });
    }

    // On réutilise l'<img> de la page : pas de 2e téléchargement
    loadImage() {
        const image = this.domImage;
        image
            .decode()
            .then(() => {
                // Encore attaché à cette image ? (le canvas a pu être recyclé entre-temps)
                if (this.isAttached && this.domImage === image) this.onImageLoad();
            })
            .catch(() => {}); // image brisée : on garde l'<img>
    }

    /*
     Événements
     ========================================================================== */

    onImageLoad() {
        this.image = this.domImage;
        this.updateSource();
        // Sans intro (déjà jouée) : on fait comme si elle était finie
        this.introStart = this.playIntro ? performance.now() : -INTRO_DURATION;
        this.start();
    }

    // Réduit la photo à la taille du canvas avant de l'envoyer à la carte graphique
    // (une photo de 8 mégapixels coûte très cher à envoyer, pour rien)
    updateSource() {
        const image = this.image;
        const [coverX] = coverScale(this.canvas.width, this.canvas.height, image.naturalWidth, image.naturalHeight);
        const scale = Math.min(1, this.canvas.width / (coverX * image.naturalWidth));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));

        // Déjà assez grande ? (on refait seulement si le canvas a grandi)
        if (this.source && width <= this.source.width) return;

        this.source = document.createElement("canvas");
        this.source.width = width;
        this.source.height = Math.max(1, Math.round(image.naturalHeight * scale));

        const context = this.source.getContext("2d");
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, this.source.width, this.source.height);

        this.imageTexture.image = this.source;
    }

    onMove(event) {
        // Position du curseur dans le canvas, en px
        const rect = this.canvas.getBoundingClientRect();
        let x = ((event.clientX - rect.left) / rect.width) * this.width;
        let y = ((event.clientY - rect.top) / rect.height) * this.height;

        // reveal 'full' : le curseur peut être hors de l'image (ex. sur le texte d'une card).
        // On ramène le point sur l'image pour que le masque la recouvre en entier.
        if (this.options.reveal === "full") {
            x = Math.min(Math.max(x, 0), this.width);
            y = Math.min(Math.max(y, 0), this.height);
        }

        this.pointer.x = x;
        this.pointer.y = y;

        // Le curseur vient d'entrer : le pinceau saute directement à sa position
        if (!this.pointer.isInside) {
            this.pointer.isInside = true;
            this.brush.x = this.brush.prevX = x;
            this.brush.y = this.brush.prevY = y;
        }

        this.start();
    }

    onLeave() {
        this.pointer.isInside = false;
        this.start();
    }

    // Appelé par DitherVeil quand l'image arrive au milieu de l'écran (ou en repart)
    setRevealed(isRevealed) {
        this.isRevealed = isRevealed;
        this.start();
    }

    onResize() {
        const width = Math.max(1, this.container.clientWidth);
        const height = Math.max(1, this.container.clientHeight);

        // Changer la taille d'un canvas le vide et le réalloue : seulement si elle change vraiment
        // (un canvas recyclé a souvent déjà la bonne taille)
        if (width !== this.renderer.width || height !== this.renderer.height) {
            this.renderer.setSize(width, height);
        }
        this.width = width;
        this.height = height;
        if (this.image) this.updateSource();

        this.viewUniforms.uResolution.value = [this.canvas.width, this.canvas.height];
        this.maskUniforms.uSize.value = [this.width, this.height];

        // Les masques (à demi-résolution) suivent la nouvelle taille
        const maskWidth = Math.max(2, Math.round(this.width * MASK_SCALE));
        const maskHeight = Math.max(2, Math.round(this.height * MASK_SCALE));

        if (maskWidth !== this.masks[0].width || maskHeight !== this.masks[0].height) {
            this.deleteMask(this.masks[0]);
            this.deleteMask(this.masks[1]);
            this.masks = [this.createMask(maskWidth, maskHeight), this.createMask(maskWidth, maskHeight)];
        }

        this.start();
    }

    /*
     Animation
     ========================================================================== */

    // Lance la boucle d'animation, si elle n'est pas déjà en cours
    start() {
        if (this.raf || this.isDestroyed || !this.isAttached) return;
        this.lastTime = performance.now();
        this.raf = requestAnimationFrame(this.render);
    }

    render(now) {
        this.raf = 0;

        // Temps écoulé depuis l'image précédente, en secondes (max 0.05 pour éviter les sauts)
        const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
        this.lastTime = now;

        this.updateBrush(dt);
        this.drawMask(dt, now);
        this.drawDither(now);

        // La boucle continue tant qu'il se passe quelque chose, sinon elle s'arrête d'elle-même
        const isIntroPlaying = this.image && now - this.introStart < INTRO_DURATION;

        // Toute l'image est en couleur et rien ne bouge : inutile de la redessiner à chaque image
        // (le canvas garde la dernière image affichée, la boucle repart au prochain mouvement)
        const isFullyRevealed = this.isRevealed || (this.pointer.isInside && this.options.reveal === "full");
        const isSteady = isFullyRevealed && this.presence > 0.995 && !isIntroPlaying;

        const isBusy = !isSteady && (this.pointer.isInside || this.isRevealed || this.presence > 0.002 || now < this.trailEnd || isIntroPlaying);

        if (isBusy) this.raf = requestAnimationFrame(this.render);
    }

    updateBrush(dt) {
        // presence glisse doucement vers 1 quand le curseur est dedans, vers 0 quand il sort
        const target = this.pointer.isInside || this.isRevealed ? 1 : 0;
        this.presence += (target - this.presence) * (1 - Math.exp(-dt / 0.16));

        // Révélée sans curseur : le pinceau part du centre de l'image
        if (this.isRevealed && !this.pointer.isInside) {
            this.pointer.x = this.width / 2;
            this.pointer.y = this.height / 2;
        }

        // Le pinceau rattrape le curseur avec un petit retard (mouvement plus doux)
        const follow = 1 - Math.exp(-dt / 0.035);
        this.brush.x += (this.pointer.x - this.brush.x) * follow;
        this.brush.y += (this.pointer.y - this.brush.y) * follow;
    }

    drawMask(dt, now) {
        // Tant que le curseur est là, on repousse la fin de la traînée
        if (this.presence > 0.002) this.trailEnd = now + LINGER * 1000 + 150;

        // Rayon de la zone révélée. reveal 'full' : assez grand pour couvrir toute l'image.
        let radius = REVEAL_RADIUS;
        if (this.options.reveal === "full" || this.isRevealed) {
            radius = Math.hypot(this.width, this.height) / (1 - SOFTNESS) + 2;
        }

        // Vitesse d'effacement de la traînée
        const minFade = this.hasFloatMask ? 0 : 1.5 / 255;

        this.maskUniforms.tPrev.value = this.masks[0].texture;
        this.maskUniforms.uFrom.value = [this.brush.prevX, this.brush.prevY];
        this.maskUniforms.uTo.value = [this.brush.x, this.brush.y];
        this.maskUniforms.uRadius.value = radius * (0.45 + 0.55 * this.presence);
        this.maskUniforms.uStrength.value = this.presence;
        this.maskUniforms.uFade.value = this.clearMask ? 1 : Math.max(dt / LINGER, minFade);
        this.clearMask = false;

        // On dessine le nouveau masque, puis il devient « le précédent » pour la prochaine image
        this.renderer.render({ scene: this.maskMesh, target: this.masks[1] });
        this.masks.reverse();

        this.brush.prevX = this.brush.x;
        this.brush.prevY = this.brush.y;
    }

    drawDither(now) {
        if (this.image) {
            // Cadrage de la photo dans le canvas (comme object-fit: cover)
            this.viewUniforms.uCover.value = coverScale(this.canvas.width, this.canvas.height, this.source.width, this.source.height);

            // Légère réduction de la photo selon la taille des points (évite le scintillement)
            const texelsPerPixel = (this.viewUniforms.uCover.value[0] * this.source.width) / this.canvas.width;
            this.viewUniforms.uLod.value = Math.log2(Math.max(this.cell * texelsPerPixel, 1));
        }

        // Apparition : 0 → 1 pendant INTRO_DURATION, en ralentissant à la fin
        const intro = this.image ? Math.min(1, (now - this.introStart) / INTRO_DURATION) : 0;
        this.viewUniforms.uIntro.value = 1 - Math.pow(1 - intro, 2);

        this.viewUniforms.tMask.value = this.masks[0].texture;
        this.renderer.render({ scene: this.viewMesh });
    }

    /*
     Nettoyage
     ========================================================================== */

    // Détache le canvas de son image et le garde pour la prochaine (ou le détruit si la réserve est pleine)
    release() {
        if (!this.isSupported || this.isDestroyed || !this.isAttached) return;
        this.isAttached = false;

        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.resizeObserver.disconnect();

        this.hoverTarget.removeEventListener("pointerenter", this.onMove);
        this.hoverTarget.removeEventListener("pointermove", this.onMove);
        this.hoverTarget.removeEventListener("pointerdown", this.onMove);
        this.hoverTarget.removeEventListener("pointerleave", this.onLeave);
        this.hoverTarget.removeEventListener("pointercancel", this.onLeave);
        this.canvas.remove();

        if (pool.length < POOL_SIZE) pool.push(this);
        else this.destroy();
    }

    destroy() {
        if (!this.isSupported || this.isDestroyed) return;
        if (this.isAttached) this.release(); // retire les écouteurs (peut le mettre dans la réserve)
        this.isDestroyed = true;

        const index = pool.indexOf(this);
        if (index >= 0) pool.splice(index, 1);

        this.resizeObserver.disconnect();
        this.canvas.removeEventListener("webglcontextlost", this.destroy);

        // Libère la carte graphique et retire le canvas WebGL
        this.gl.getExtension("WEBGL_lose_context")?.loseContext();
        this.canvas.remove();
    }
}
