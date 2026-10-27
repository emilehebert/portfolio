// Formulaire de contact : valide les champs puis envoie le message par Web3Forms (le site est statique, pas de serveur)
// Le courriel arrive dans la boîte liée à la clé access_key du formulaire
export default class ContactForm {
    constructor(element) {
        this.element = element;

        this.form = this.element.querySelector("form");
        this.button = this.element.querySelector(".js-submit");
        this.status = this.element.querySelector(".js-status");
        this.fields = this.form.querySelectorAll("input[name]:not([type='hidden']):not([name='botcheck']), textarea");
        this.defaultStatus = this.status.textContent;

        this.init();
    }

    init() {
        this.form.addEventListener("submit", this.onSubmit.bind(this));

        // Une fois qu'un champ est en erreur, l'erreur se met à jour pendant qu'on tape
        for (let i = 0; i < this.fields.length; i++) {
            const field = this.fields[i];
            field.addEventListener("input", () => {
                if (field.getAttribute("aria-invalid") === "true") this.validateField(field);
            });
        }
    }

    // Retourne le message d'erreur du champ, ou "" s'il est valide
    // Messages courts : ils doivent tenir sur une ligne, dans l'espace sous le champ
    getError(field) {
        const value = field.value.trim();

        if (field.required && !value) return "Ce champ est requis.";
        if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return "Courriel invalide.";
        }
        if (field.type === "tel" && value && value.replace(/\D/g, "").length < 10) {
            return "10 chiffres requis.";
        }
        if (field.tagName === "TEXTAREA" && value && value.length < 10) {
            return "10 caractères minimum.";
        }
        return "";
    }

    // Affiche ou retire l'erreur sous le champ (lue par les lecteurs d'écran grâce à aria-describedby)
    validateField(field) {
        const error = this.getError(field);
        const errorText = document.getElementById(`${field.id}-error`);

        errorText.textContent = error;
        field.setAttribute("aria-invalid", error ? "true" : "false");
        return !error;
    }

    async onSubmit(e) {
        e.preventDefault();
        if (this.button.disabled) return;

        // Valide tous les champs, puis place le focus sur le premier en erreur
        let firstInvalid = null;
        for (let i = 0; i < this.fields.length; i++) {
            if (!this.validateField(this.fields[i]) && !firstInvalid) firstInvalid = this.fields[i];
        }
        if (firstInvalid) {
            this.setStatus("error", "[Vérifiez les champs en rouge]");
            firstInvalid.focus();
            return;
        }

        // Honeypot : un robot remplit la case cachée, on fait semblant que ça a marché
        if (this.form.botcheck.checked) {
            this.setStatus("success", "[Message envoyé. Merci!]");
            return;
        }

        this.setSending(true);
        this.setStatus("", "[Envoi en cours...]");

        try {
            const response = await fetch(this.form.action, {
                method: "POST",
                headers: { Accept: "application/json" },
                body: new FormData(this.form),
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message);

            this.form.reset();
            this.setStatus("success", "[Message envoyé. Merci, je vous réponds bientôt!]");
        } catch (error) {
            // La raison exacte (ex.: clé access_key invalide) reste visible dans la console
            console.error("Web3Forms :", error.message);
            this.setStatus("error", "[Erreur d'envoi. Réessayez ou écrivez à hebert.emile96@gmail.com]");
        }

        this.setSending(false);
    }

    // Bouton désactivé pendant l'envoi pour éviter les doublons
    setSending(isSending) {
        this.button.disabled = isSending;
        this.form.setAttribute("aria-busy", isSending);
    }

    // type : "success", "error" ou "" (neutre)
    setStatus(type, text) {
        this.status.textContent = text || this.defaultStatus;
        this.status.classList.toggle("is-success", type === "success");
        this.status.classList.toggle("is-error", type === "error");
    }
}
