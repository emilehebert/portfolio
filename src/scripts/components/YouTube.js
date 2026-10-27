// Vidéo YouTube : démarre quand elle apparaît (modale ouverte), pause quand elle disparaît
// Options en data-attributs : data-autoplay="false", data-restart="false", data-mute="true",
// data-loop="true", data-controls="false", data-fullscreen="false", data-color="white"
export default class YouTube {
    constructor(element) {
        this.element = element;
        this.options = {
            autoplay: true, // joue dès l'ouverture
            restart: true, // recommence au début à chaque ouverture
            mute: false, // son coupé
            loop: false, // recommence à la fin
            controls: true, // barre de contrôle YouTube
            fullscreen: true, // bouton plein écran
            color: "--color-primary", // barre de progression : 'red' ou 'white'
        };

        this.videoContainer = this.element.querySelector(".js-video");
        this.videoId = this.element.dataset.videoId;
        this.player = null;

        // Contrôles maison (optionnels), cachés après 3 s sans bouger la souris
        this.controls = this.element.querySelector(".js-youtube-controls");
        this.hideDelay = 3000;
        this.hideTimeout = null;
        this.progressInterval = null;
        this.endScreenDuration = 20; // secondes, durée max de l'écran de fin YouTube

        this.setOptions();
        YouTube.instances.push(this);

        if (this.videoId) {
            // Charge YouTube seulement quand la vidéo apparaît (modale ouverte), pas au chargement de la page
            const observer = new IntersectionObserver((entries) => {
                if (!entries[0].isIntersecting) return;
                observer.disconnect();
                YouTube.loadScript();
            });
            observer.observe(this.element);
        } else {
            console.error("Vous devez spécifier un id");
        }
    }

    setOptions() {
        if (this.element.dataset.autoplay === "false") {
            this.options.autoplay = false;
        }

        if (this.element.dataset.restart === "false") {
            this.options.restart = false;
        }

        if (this.element.dataset.mute === "true") {
            this.options.mute = true;
        }

        if (this.element.dataset.loop === "true") {
            this.options.loop = true;
        }

        if (this.element.dataset.controls === "false") {
            this.options.controls = false;
        }

        if (this.element.dataset.fullscreen === "false") {
            this.options.fullscreen = false;
        }

        if (this.element.dataset.color) {
            this.options.color = this.element.dataset.color;
        }
    }

    static loadScript() {
        if (!YouTube.scriptIsLoading) {
            YouTube.scriptIsLoading = true;
            const script = document.createElement("script");
            script.src = "https://www.youtube.com/iframe_api";
            document.body.appendChild(script);
        }
    }

    init() {
        this.player = new YT.Player(this.videoContainer, {
            height: "100%",
            width: "100%",
            videoId: this.videoId,
            playerVars: {
                rel: 0,
                controls: this.options.controls ? 1 : 0,
                fs: this.options.fullscreen ? 1 : 0,
                color: this.options.color,
            },
            events: {
                onReady: () => {
                    if (this.options.mute) {
                        this.player.mute();
                    }

                    if (this.controls) {
                        this.initControls();
                    }

                    const observer = new IntersectionObserver(this.watch.bind(this));
                    observer.observe(this.element);
                },
                onStateChange: (event) => {
                    if (event.data === YT.PlayerState.ENDED && this.options.loop) {
                        this.player.seekTo(0);
                    }

                    if (this.controls) {
                        this.updateControls(event.data);
                    }
                },
            },
        });
    }

    // La couche .js-youtube-shield cache la souris à YouTube : son overlay (titre, barre) disparaît seul.
    // On affiche nos contrôles à la place, 3 s après chaque mouvement de souris.
    initControls() {
        this.playButton = this.controls.querySelector(".js-youtube-play");
        this.muteButton = this.controls.querySelector(".js-youtube-mute");
        this.progress = this.controls.querySelector(".js-youtube-progress");
        this.bar = this.controls.querySelector(".js-youtube-bar");
        this.time = this.controls.querySelector(".js-youtube-time");
        const shield = this.element.querySelector(".js-youtube-shield");

        shield.addEventListener("click", this.togglePlay.bind(this));
        shield.addEventListener("dblclick", this.toggleFullscreen.bind(this));
        this.playButton.addEventListener("click", this.togglePlay.bind(this));
        this.muteButton.addEventListener("click", this.toggleMute.bind(this));
        this.volume = this.controls.querySelector(".js-youtube-volume");
        this.volume.addEventListener("input", this.changeVolume.bind(this));
        // Relâché à la souris : on retire le focus, sinon le panneau du volume reste ouvert (:focus-visible)
        this.volume.addEventListener("pointerup", () => this.volume.blur());
        this.controls.querySelector(".js-youtube-fullscreen").addEventListener("click", this.toggleFullscreen.bind(this));
        this.progress.addEventListener("click", this.seek.bind(this));
        this.element.addEventListener("mousemove", this.showControls.bind(this));
        this.element.addEventListener("mouseleave", this.hideControls.bind(this));

        this.updateVolume(this.player.isMuted() ? 0 : this.player.getVolume());
    }

    updateControls(state) {
        const isPaused = state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED;
        this.playButton.textContent = isPaused ? "Lecture" : "Pause";
        this.element.classList.toggle("is-paused", isPaused); // en pause, les contrôles restent visibles

        clearInterval(this.progressInterval);
        if (state === YT.PlayerState.PLAYING) {
            this.progressInterval = setInterval(this.updateProgress.bind(this), 100);
            this.showControls(); // visibles 3 s au lancement
        }
    }

    showControls() {
        this.element.classList.add("is-controls-visible");
        clearTimeout(this.hideTimeout);
        // Restent affichés tant que la souris est sur les contrôles (ex: slider du volume)
        this.hideTimeout = setTimeout(() => {
            if (!this.controls.matches(":hover")) this.hideControls();
        }, this.hideDelay);
    }

    hideControls() {
        clearTimeout(this.hideTimeout);
        this.element.classList.remove("is-controls-visible");
    }

    togglePlay() {
        if (this.player.getPlayerState() === YT.PlayerState.PLAYING) {
            this.player.pauseVideo();
        } else {
            this.player.playVideo();
        }
    }

    // Le bouton coupe le son, puis le remet au volume d'avant
    toggleMute() {
        if (Number(this.volume.value) === 0) {
            const volume = this.player.getVolume() || 100; // volume d'avant, ou 100 s'il était à 0
            this.player.setVolume(volume);
            this.player.unMute();
            this.updateVolume(volume);
        } else {
            this.player.mute();
            this.updateVolume(0);
        }
    }

    // Glisser le slider : 0 coupe le son, le reste règle le volume
    changeVolume() {
        const volume = Number(this.volume.value);

        if (volume === 0) {
            this.player.mute();
        } else {
            this.player.setVolume(volume);
            this.player.unMute();
        }

        this.updateVolume(volume);
    }

    updateVolume(volume) {
        this.volume.value = volume;
        this.volume.style.setProperty("--volume", `${volume}%`);
        this.muteButton.textContent = volume === 0 ? "Muet" : "Son";
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            this.element.requestFullscreen(); // le bloc entier, pour garder nos contrôles en plein écran
        }
    }

    // Avance au point cliqué sur la barre
    seek(event) {
        const rect = this.progress.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        const duration = this.player.getDuration();
        this.player.seekTo(ratio * duration, true);
        this.bar.style.transform = `scaleX(${ratio})`;
        this.updateTime(ratio * duration, duration);
    }

    updateProgress() {
        const duration = this.player.getDuration();
        if (duration) {
            const time = this.player.getCurrentTime();
            this.bar.style.transform = `scaleX(${time / duration})`;
            this.updateTime(time, duration);
            // Écran de fin YouTube (20 s max) : on retire la couche pour pouvoir cliquer la vidéo suggérée et le profil
            this.element.classList.toggle("is-ending", duration - time < this.endScreenDuration);
        }
    }

    // Time code : « 0:12 / 1:45 »
    updateTime(time, duration) {
        this.time.textContent = `${this.formatTime(time)} / ${this.formatTime(duration)}`;
    }

    // 75 → « 1:15 »
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const rest = Math.floor(seconds % 60);
        return `${minutes}:${String(rest).padStart(2, "0")}`;
    }

    watch(entries) {
        if (entries[0].isIntersecting) {
            this.show();
        } else {
            this.player.pauseVideo();
        }
    }

    show() {
        if (this.options.restart && this.options.autoplay) {
            this.player.loadVideoById(this.videoId); // au début, et joue
        } else if (this.options.restart) {
            this.player.cueVideoById(this.videoId); // au début, en attente
        } else if (this.options.autoplay) {
            this.player.playVideo(); // reprend où elle était
        }
    }

    static initAll() {
        for (let i = 0; i < YouTube.instances.length; i++) {
            const instance = YouTube.instances[i];
            instance.init();
        }
    }
}

YouTube.instances = [];
window.onYouTubeIframeAPIReady = YouTube.initAll;
