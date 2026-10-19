import { ScrollSmoother } from 'gsap/ScrollSmoother';

// Modale unique : s'ouvre avec les liens data-modal="video" ou data-modal="image"
// La valeur de data-modal choisit le contenu affiché (classe modal--video ou modal--image)
export default class Modal {
  constructor(element) {
    this.element = element;

    this.links = document.querySelectorAll('[data-modal]');
    this.closeLink = this.element.querySelector('.js-close');
    this.title = this.element.querySelector('.js-modal-title');

    this.init();
  }

  init() {
    for (let i = 0; i < this.links.length; i++) {
      this.links[i].addEventListener('click', this.open.bind(this));
    }

    this.closeLink.addEventListener('click', this.close.bind(this));
    this.element.addEventListener('click', this.onClickOutside.bind(this));
  }

  open(event) {
    event.preventDefault();
    const link = event.currentTarget;
    const type = link.dataset.modal; // "video" ou "image"

    // Affiche le bon contenu, le CSS cache l'autre
    this.element.classList.toggle('modal--video', type === 'video');
    this.element.classList.toggle('modal--image', type === 'image');

    if (type === 'image') {
      this.showImage(link);
    } else {
      this.title.textContent = link.dataset.title || '';
    }

    this.element.classList.add('is-open');
    ScrollSmoother.get().paused(true);
  }

  close(event) {
    event.preventDefault();
    this.element.classList.remove('is-open');
    ScrollSmoother.get().paused(false);
  }

  // Modale image : copie l'image cliquée et le titre de sa fenêtre dans la modale
  showImage(link) {
    const image = this.element.querySelector('.js-modal-image');
    const source = link.querySelector('img');
    if (!image || !source) return;

    image.src = source.currentSrc || source.src;
    image.alt = source.alt;

    const name = link.querySelector('.window__header p');
    this.title.textContent = name ? name.textContent : source.alt;
  }

  // Ferme si on clique à côté de la fenêtre
  onClickOutside(event) {
    if (event.target === this.element) {
      this.close(event);
    }
  }
}
