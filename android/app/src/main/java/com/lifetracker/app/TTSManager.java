package com.lifetracker.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import java.util.Locale;

public class TTSManager {
    private static final String TAG = "LifeTrackerTTS";
    private static TextToSpeech sCurrentTTS = null;
    private static final Handler sMainHandler = new Handler(Looper.getMainLooper());
    private static Runnable sPendingRepeatRunnable = null;
    private static Runnable sSafetyTimeoutRunnable = null;
    private static boolean sIsCancelled = false;
    private static PowerManager.WakeLock sCurrentWakeLock = null;

    public interface OnSpeechCompleteListener {
        void onComplete();
    }

    public interface OnSpeechProgressListener {
        void onProgress(int current, int total);
    }

    public static void stop() {
        sMainHandler.post(() -> {
            sIsCancelled = true;
            if (sPendingRepeatRunnable != null) {
                sMainHandler.removeCallbacks(sPendingRepeatRunnable);
                sPendingRepeatRunnable = null;
            }
            if (sSafetyTimeoutRunnable != null) {
                sMainHandler.removeCallbacks(sSafetyTimeoutRunnable);
                sSafetyTimeoutRunnable = null;
            }
            try {
                if (sCurrentTTS != null) {
                    sCurrentTTS.stop();
                    sCurrentTTS.shutdown();
                    sCurrentTTS = null;
                }
            } catch (Exception ignore) {}
            try {
                if (sCurrentWakeLock != null && sCurrentWakeLock.isHeld()) {
                    sCurrentWakeLock.release();
                    sCurrentWakeLock = null;
                }
            } catch (Exception ignore) {}
        });
    }

    public static void speak(Context context, String text, boolean isAlarm, OnSpeechCompleteListener listener) {
        speakSequence(context, text, 1, isAlarm, null, listener);
    }

    public static void speakSequence(Context context, String text, int totalPlays, boolean isAlarm, OnSpeechCompleteListener listener) {
        speakSequence(context, text, totalPlays, isAlarm, null, listener);
    }

    public static void speakSequence(Context context, String text, int totalPlays, boolean isAlarm, OnSpeechProgressListener progressListener, OnSpeechCompleteListener listener) {
        if (text == null || text.trim().isEmpty()) {
            if (listener != null) listener.onComplete();
            return;
        }

        final int count = Math.max(1, totalPlays);
        final String textToSpeak = text.trim();
        final Context appContext = context.getApplicationContext();

        // Stop any currently running speech
        stop();

        sMainHandler.post(() -> {
            sIsCancelled = false;

            // Keep CPU awake while TTS speaks (estimated 3.5s per speech + 2s gap)
            PowerManager pm = (PowerManager) appContext.getSystemService(Context.POWER_SERVICE);
            PowerManager.WakeLock wakeLock = null;
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LifeTracker:TTSWakeLock");
                long maxWakeMs = Math.max(15000L, (count * 4500L) + ((count - 1) * 2000L) + 5000L);
                wakeLock.acquire(maxWakeMs);
            }
            sCurrentWakeLock = wakeLock;

            try {
                TextToSpeech[] ttsHolder = new TextToSpeech[1];
                final int[] currentPlay = new int[]{0};
                final boolean[] isDone = new boolean[]{false};

                ttsHolder[0] = new TextToSpeech(appContext, status -> {
                    if (status == TextToSpeech.SUCCESS) {
                        try {
                            if (sIsCancelled) {
                                cleanup(ttsHolder[0], listener);
                                return;
                            }

                            TextToSpeech tts = ttsHolder[0];
                            sCurrentTTS = tts;
                            int langResult = tts.setLanguage(Locale.getDefault());
                            if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                                tts.setLanguage(Locale.US);
                            }

                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                                    .setUsage(isAlarm ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_NOTIFICATION)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                    .build();
                                tts.setAudioAttributes(audioAttributes);
                            }

                            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                                @Override
                                public void onStart(String id) {
                                    Log.d(TAG, "TTS speech started: " + id + " (" + currentPlay[0] + "/" + count + ")");
                                }

                                @Override
                                public void onDone(String id) {
                                    Log.d(TAG, "TTS speech finished: " + id + " (" + currentPlay[0] + "/" + count + ")");
                                    sMainHandler.post(() -> {
                                        if (sSafetyTimeoutRunnable != null) {
                                            sMainHandler.removeCallbacks(sSafetyTimeoutRunnable);
                                            sSafetyTimeoutRunnable = null;
                                        }

                                        if (sIsCancelled || isDone[0]) return;

                                        if (currentPlay[0] < count) {
                                            // Fixed 2-second gap (2000ms) before repeating speech
                                            sPendingRepeatRunnable = () -> {
                                                sPendingRepeatRunnable = null;
                                                if (!sIsCancelled && !isDone[0]) {
                                                    speakNextIteration(tts, textToSpeak, count, currentPlay, isDone, progressListener, listener);
                                                }
                                            };
                                            sMainHandler.postDelayed(sPendingRepeatRunnable, 2000L);
                                        } else {
                                            if (!isDone[0]) {
                                                isDone[0] = true;
                                                cleanup(tts, listener);
                                            }
                                        }
                                    });
                                }

                                @Override
                                public void onError(String id) {
                                    Log.w(TAG, "TTS speech error on id: " + id);
                                    sMainHandler.post(() -> {
                                        if (sSafetyTimeoutRunnable != null) {
                                            sMainHandler.removeCallbacks(sSafetyTimeoutRunnable);
                                            sSafetyTimeoutRunnable = null;
                                        }
                                        if (!isDone[0]) {
                                            isDone[0] = true;
                                            cleanup(tts, listener);
                                        }
                                    });
                                }
                            });

                            speakNextIteration(tts, textToSpeak, count, currentPlay, isDone, progressListener, listener);

                        } catch (Exception ex) {
                            Log.e(TAG, "Error configuring TTS", ex);
                            cleanup(ttsHolder[0], listener);
                        }
                    } else {
                        Log.w(TAG, "TTS initialization failed: " + status);
                        cleanup(ttsHolder[0], listener);
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Error creating TextToSpeech", e);
                cleanup(null, listener);
            }
        });
    }

    private static void speakNextIteration(TextToSpeech tts, String text, int totalPlays, int[] currentPlay, boolean[] isDone, OnSpeechProgressListener progressListener, OnSpeechCompleteListener listener) {
        if (sIsCancelled || isDone[0] || tts == null) return;
        currentPlay[0]++;
        Log.d(TAG, "Speaking iteration " + currentPlay[0] + " of " + totalPlays);

        if (progressListener != null) {
            try {
                progressListener.onProgress(currentPlay[0], totalPlays);
            } catch (Exception ignore) {}
        }

        String utteranceId = "utterance_" + currentPlay[0] + "_" + System.currentTimeMillis();

        // Safety timeout per utterance: if engine hangs, guarantee progress within 6s
        sSafetyTimeoutRunnable = () -> {
            sSafetyTimeoutRunnable = null;
            if (!sIsCancelled && !isDone[0]) {
                Log.w(TAG, "TTS utterance timed out, advancing or completing");
                if (currentPlay[0] < totalPlays) {
                    sPendingRepeatRunnable = () -> {
                        sPendingRepeatRunnable = null;
                        if (!sIsCancelled && !isDone[0]) {
                            speakNextIteration(tts, text, totalPlays, currentPlay, isDone, progressListener, listener);
                        }
                    };
                    sMainHandler.postDelayed(sPendingRepeatRunnable, 2000L);
                } else {
                    isDone[0] = true;
                    cleanup(tts, listener);
                }
            }
        };
        sMainHandler.postDelayed(sSafetyTimeoutRunnable, 6000L);

        try {
            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
            } else {
                @SuppressWarnings("deprecation")
                java.util.HashMap<String, String> map = new java.util.HashMap<>();
                map.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, map);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to call tts.speak", e);
            if (sSafetyTimeoutRunnable != null) {
                sMainHandler.removeCallbacks(sSafetyTimeoutRunnable);
                sSafetyTimeoutRunnable = null;
            }
            if (!isDone[0]) {
                isDone[0] = true;
                cleanup(tts, listener);
            }
        }
    }

    private static void cleanup(TextToSpeech tts, OnSpeechCompleteListener listener) {
        sMainHandler.postDelayed(() -> {
            try {
                if (tts != null) {
                    tts.stop();
                    tts.shutdown();
                    if (sCurrentTTS == tts) {
                        sCurrentTTS = null;
                    }
                }
            } catch (Exception ignore) {}
            try {
                if (sCurrentWakeLock != null && sCurrentWakeLock.isHeld()) {
                    sCurrentWakeLock.release();
                    sCurrentWakeLock = null;
                }
            } catch (Exception ignore) {}
            if (listener != null) {
                listener.onComplete();
            }
        }, 150);
    }
}
