
export class AudioFeedback {
    constructor() {
        if ('speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.voice = this.getVoice();
            this.synth.onvoiceschanged = () => {
                this.voice = this.getVoice();
                console.log('Voices changed, new voice:', this.voice);
            };
            console.log('Web Speech API supported.');
            console.log('Initial voice:', this.voice);
        } else {
            console.warn('Web Speech API not supported');
            this.synth = null;
        }
    }

    getVoice() {
        const voice = this.synth.getVoices().find(voice => voice.lang === 'en-US') || this.synth.getVoices()[0];
        if (!voice) {
            console.warn('No voices found!');
        }
        return voice;
    }

    speak(message) {
        if (this.synth && message) {
            if (!this.voice) {
                console.warn('Cannot speak: No voice selected.');
                return;
            }
            console.log('Attempting to speak:', message);
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.voice = this.voice;
            utterance.rate = 1.2; // Slightly faster
            utterance.pitch = 1; // Normal pitch
            utterance.onend = () => console.log('Speech finished.');
            utterance.onerror = (event) => console.error('Speech synthesis error:', event.error);
            this.synth.speak(utterance);
        } else {
            console.log('Speech synthesis not available or message is empty.');
        }
    }

    cancel() {
        if (this.synth) {
            this.synth.cancel();
        }
    }
}
