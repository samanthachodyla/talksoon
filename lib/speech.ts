// Thin wrapper around the browser's built-in speech recognition (on iPhone this
// is Apple's own dictation engine). Free, no extra API key.
//
// iOS stops listening after a pause, so we quietly restart until you tap Done.

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () => getRecognitionClass() !== null;

export type Listener = {
  /** Stops listening. Resolves once iOS has delivered the last words (or after a short wait). */
  stop: () => Promise<string>;
  cancel: () => void;
};

export function startListening(opts: {
  onText: (text: string) => void;
  onFatalError: (message: string) => void;
}): Listener | null {
  const Rec = getRecognitionClass();
  if (!Rec) return null;

  let finalText = "";
  let interim = "";
  let active = true;
  let rec: Recognition;
  let onFinished: (() => void) | null = null;

  const emit = () => opts.onText((finalText + " " + interim).trim());

  const begin = () => {
    rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onresult = (e) => {
      interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = (finalText + " " + r[0].transcript).trim();
        else interim += r[0].transcript;
      }
      emit();
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        active = false;
        opts.onFatalError(
          "Microphone or speech access is off. Check Settings → Safari → Microphone, or just type below.",
        );
      }
      // "no-speech" / "aborted" / "network" fall through to onend → restart.
    };

    rec.onend = () => {
      // Keep whatever was mid-sentence when iOS cut us off.
      if (interim) {
        finalText = (finalText + " " + interim).trim();
        interim = "";
      }
      if (active) {
        try {
          begin();
        } catch {
          /* ignore */
        }
      } else {
        onFinished?.();
      }
    };

    rec.start();
  };

  try {
    begin();
  } catch {
    return null;
  }

  return {
    stop: () =>
      new Promise<string>((resolve) => {
        active = false;
        const finish = () => {
          onFinished = null;
          resolve((finalText + " " + interim).trim());
        };
        onFinished = finish;
        setTimeout(finish, 1500); // Don't hang if iOS never says it's done.
        try {
          rec.stop();
        } catch {
          finish();
        }
      }),
    cancel: () => {
      active = false;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
