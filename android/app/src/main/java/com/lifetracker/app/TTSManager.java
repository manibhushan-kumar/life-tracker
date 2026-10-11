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

    public interface OnSpeechCompleteListener {
        void onComplete();
    }

    public static void stop() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (sCurrentTTS != null) {
                    sCurrentTTS.stop();
                    sCurrentTTS.shutdown();
                    sCurrentTTS = null;
                }
            } catch (Exception ignore) {}
        });
    }

    public static void speak(Context context, String text, boolean isAlarm, OnSpeechCompleteListener listener) {
        if (text == null || text.trim().isEmpty()) {
            if (listener != null) listener.onComplete();
            return;
        }

        final String textToSpeak = text.trim();
        final Context appContext = context.getApplicationContext();

        // Keep CPU awake while TTS initializes and speaks
        PowerManager pm = (PowerManager) appContext.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LifeTracker:TTSWakeLock");
            wakeLock.acquire(15000); // 15 seconds max
        }
        final PowerManager.WakeLock finalWl = wakeLock;

        Handler mainHandler = new Handler(Looper.getMainLooper());
        mainHandler.post(() -> {
            try {
                TextToSpeech[] ttsHolder = new TextToSpeech[1];
                ttsHolder[0] = new TextToSpeech(appContext, status -> {
                    if (status == TextToSpeech.SUCCESS) {
                        try {
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

                            final boolean[] isDone = new boolean[]{false};

                            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                                @Override
                                public void onStart(String id) {
                                    Log.d(TAG, "TTS speech started for: " + textToSpeak);
                                }

                                @Override
                                public void onDone(String id) {
                                    Log.d(TAG, "TTS speech finished");
                                    if (!isDone[0]) {
                                        isDone[0] = true;
                                        cleanup(tts, finalWl, listener);
                                    }
                                }

                                @Override
                                public void onError(String id) {
                                    Log.w(TAG, "TTS speech error");
                                    if (!isDone[0]) {
                                        isDone[0] = true;
                                        cleanup(tts, finalWl, listener);
                                    }
                                }
                            });

                            // Safety timeout: guarantee onComplete within 5s if engine hangs
                            mainHandler.postDelayed(() -> {
                                if (!isDone[0]) {
                                    isDone[0] = true;
                                    Log.w(TAG, "TTS speech timed out after 5s");
                                    cleanup(ttsHolder[0], finalWl, listener);
                                }
                            }, 5000);

                            String utteranceId = "utterance_" + System.currentTimeMillis();
                            Bundle params = new Bundle();
                            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                tts.speak(textToSpeak, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
                            } else {
                                @SuppressWarnings("deprecation")
                                java.util.HashMap<String, String> map = new java.util.HashMap<>();
                                map.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
                                tts.speak(textToSpeak, TextToSpeech.QUEUE_FLUSH, map);
                            }
                        } catch (Exception ex) {
                            Log.e(TAG, "Error executing TTS speak", ex);
                            cleanup(ttsHolder[0], finalWl, listener);
                        }
                    } else {
                        Log.w(TAG, "TTS initialization failed with status: " + status);
                        cleanup(ttsHolder[0], finalWl, listener);
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Error creating TextToSpeech", e);
                cleanup(null, finalWl, listener);
            }
        });
    }

    private static void cleanup(TextToSpeech tts, PowerManager.WakeLock wakeLock, OnSpeechCompleteListener listener) {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
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
                if (wakeLock != null && wakeLock.isHeld()) {
                    wakeLock.release();
                }
            } catch (Exception ignore) {}
            if (listener != null) {
                listener.onComplete();
            }
        }, 150);
    }
}
