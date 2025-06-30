
export class AudioFeedback {
    constructor() {
        if ('speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.voice = this.getVoice();
            this.synth.onvoiceschanged = () => {
                this.voice = this.getVoice();
            };
        } else {
            console.warn('Web Speech API not supported');
            this.synth = null;
        }
    }

    getVoice() {
        return this.synth.getVoices().find(voice => voice.lang === 'en-US') || this.synth.getVoices()[0];
    }

    speak(message) {
        if (this.synth && message) {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.voice = this.voice;
            utterance.rate = 1.2; // Slightly faster
            utterance.pitch = 1; // Normal pitch
            this.synth.speak(utterance);
        }
    }

    cancel() {
        if (this.synth) {
            this.synth.cancel();
        }
    }
}
