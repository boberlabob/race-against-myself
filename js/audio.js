
export class AudioFeedback {
    constructor() {
        this.muted = false;
        this.SPEECH_RATE = 1.2;
        this.SPEECH_PITCH = 1;
        if ('speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            // this.voice = this.getVoice(); // Initial voice setting moved to onvoiceschanged
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

    setMuted(isMuted) {
        this.muted = isMuted;
    }

    getVoice() {
        const voices = this.synth.getVoices();
        if (voices.length === 0) {
            console.warn('No voices found!');
            return null;
        }
        const voice = voices.find(voice => voice.lang === 'de-DE') || voices[0];
        return voice;
    }

    speak(message) {
        if (this.synth && message && !this.muted) {
            if (!this.voice) {
                console.warn('Cannot speak: No voice selected.');
                return;
            }
            console.log('Attempting to speak:', message);
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.voice = this.voice;
            utterance.rate = this.SPEECH_RATE; // Slightly faster
            utterance.pitch = this.SPEECH_PITCH; // Normal pitch
            utterance.onend = () => console.log('Speech finished.');
            utterance.onerror = (event) => console.error('Speech synthesis error:', event.error);
            this.synth.speak(utterance);
        } else if (this.muted) {
            console.log('Audio is muted. Message not spoken:', message);
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
