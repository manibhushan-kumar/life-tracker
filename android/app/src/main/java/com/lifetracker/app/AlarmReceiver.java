package com.lifetracker.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import java.io.File;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "LifeTrackerAlarm";
    public static final String REMINDER_CHANNEL_ID = "life_tracker_reminder_channel_v5";

    private static MediaPlayer sCurrentMediaPlayer = null;
    private static Handler sSoundHandler = null;
    private static Runnable sNextPlayRunnable = null;
    private static PowerManager.WakeLock sSoundWakeLock = null;
    private static volatile boolean sIsSoundPlaying = false;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String alarmId = intent.getStringExtra("alarm_id");

        Log.d(TAG, "AlarmReceiver fired for action: " + action + ", alarmId: " + alarmId);

        if (alarmId == null || alarmId.isEmpty()) return;

        // 1. Verify alarm is active in AlarmsStorage (if paused or cancelled, drop immediately)
        JSONObject storedAlarm = AlarmsStorage.getAlarm(context, alarmId);
        if (storedAlarm == null) {
            Log.w(TAG, "Alarm " + alarmId + " not found in storage (was paused, deleted, or completed). Skipping trigger.");
            return;
        }

        if (storedAlarm.optBoolean("paused", false)) {
            Log.w(TAG, "Alarm " + alarmId + " is marked paused in storage. Skipping trigger.");
            return;
        }

        String mode = intent.getStringExtra("mode");
        if (mode == null || mode.isEmpty()) {
            mode = storedAlarm.optString("mode", "alarm");
        }

        // 2. Alarm vs Notification handling:
        if ("notification".equalsIgnoreCase(mode)) {
            // Standard notification mode: works identically whether app is open or closed!
            postReminderNotification(context, intent, storedAlarm);

            if (MainActivity.isForeground()) {
                AlarmPlugin.emitAlarmEvent("reminderTriggeredForeground", alarmId);
            }

            // Automatically reschedule recurring notifications for their next occurrence!
            try {
                String repeat = storedAlarm.optString("repeat", "None");
                if (!repeat.isEmpty() && !"None".equalsIgnoreCase(repeat)) {
                    long currentTimestamp = storedAlarm.optLong("timestamp", System.currentTimeMillis());
                    long nextTimestamp = AlarmScheduler.calculateNextOccurrence(
                        currentTimestamp,
                        repeat,
                        storedAlarm.optInt("customInterval", 1),
                        storedAlarm.optString("customUnit", "days")
                    );
                    storedAlarm.put("timestamp", nextTimestamp);
                    storedAlarm.put("snoozed", false);
                    storedAlarm.put("lastTriggeredAt", System.currentTimeMillis());
                    AlarmScheduler.scheduleAlarm(context, storedAlarm);
                    Log.d(TAG, "Recurring notification " + alarmId + " rescheduled for next occurrence: " + nextTimestamp);
                } else {
                    String afterAlertAction = storedAlarm.optString("afterAlertAction", "complete");
                    if ("pause".equalsIgnoreCase(afterAlertAction)) {
                        storedAlarm.put("paused", true);
                        storedAlarm.put("completed", false);
                    } else {
                        storedAlarm.put("completed", true);
                        storedAlarm.put("paused", false);
                    }
                    storedAlarm.put("lastTriggeredAt", System.currentTimeMillis());
                    AlarmsStorage.saveAlarm(context, storedAlarm);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error rescheduling recurring notification", e);
            }
        } else {
            // Phone Alarm mode (loud looping alarm screen):
            if (storedAlarm != null) {
                try {
                    storedAlarm.put("lastTriggeredAt", System.currentTimeMillis());
                    AlarmsStorage.saveAlarm(context, storedAlarm);
                } catch (Exception ignore) {}
            }
            if (MainActivity.isForeground()) {
                Log.d(TAG, "App is open in foreground. Emitting alarmTriggeredForeground for: " + alarmId);
                AlarmPlugin.emitAlarmEvent("alarmTriggeredForeground", alarmId);
            } else {
                // Closed or locked: Start AlarmService & AlarmActivity
                triggerAlarmServiceAndActivity(context, intent);
            }
        }
    }

    private void triggerAlarmServiceAndActivity(Context context, Intent intent) {
        // Acquire wake lock to illuminate locked screen safely
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                @SuppressWarnings("deprecation")
                int wakeFlags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                                PowerManager.ON_AFTER_RELEASE;
                PowerManager.WakeLock wakeLock = pm.newWakeLock(wakeFlags, "LifeTracker:AlarmReceiverWakeLock");
                wakeLock.acquire(30000); // 30 seconds
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire screen wake lock in AlarmReceiver", e);
        }

        try {
            // 1. Start AlarmService (Foreground service with silent channel and ONE looping audio stream)
            Intent serviceIntent = new Intent(context, AlarmService.class);
            serviceIntent.putExtras(intent);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }

            // 2. Launch AlarmActivity (Full-screen lock-screen UI)
            Intent activityIntent = new Intent(context, AlarmActivity.class);
            activityIntent.putExtras(intent);
            activityIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            context.startActivity(activityIntent);
        } catch (Exception e) {
            Log.e(TAG, "Error starting alarm service or activity", e);
        }
    }

    private void postReminderNotification(Context context, Intent intent, JSONObject storedAlarm) {
        try {
            String alarmId = intent.getStringExtra("alarm_id");
            String title = intent.getStringExtra("title");
            String note = intent.getStringExtra("note");
            String soundId = intent.getStringExtra("sound_id");
            String alertStyle = intent.getStringExtra("alert_style");
            int playCount = intent.getIntExtra("play_count", 1);

            if (title == null || title.isEmpty()) {
                title = storedAlarm != null ? storedAlarm.optString("title", "Reminder") : "Reminder";
            }
            if (note == null && storedAlarm != null) {
                note = storedAlarm.optString("note", "");
            }
            if ((soundId == null || soundId.isEmpty()) && storedAlarm != null) {
                soundId = storedAlarm.optString("soundId", "default");
            }
            if ((alertStyle == null || alertStyle.isEmpty()) && storedAlarm != null) {
                alertStyle = storedAlarm.optString("alertStyle", "both");
            }
            if (playCount <= 0 && storedAlarm != null) {
                playCount = storedAlarm.optInt("playCount", 1);
            }
            if (playCount <= 0) playCount = 1;

            // Acquire temporary screen wake lock to illuminate locked phone screen so notification is visible
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                @SuppressWarnings("deprecation")
                int wakeFlags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                                PowerManager.ON_AFTER_RELEASE;
                PowerManager.WakeLock screenLock = pm.newWakeLock(wakeFlags, "LifeTracker:ReminderScreenWakeLock");
                screenLock.acquire(8000); // 8 seconds
            }

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            boolean isBannerOnly = "banner_only".equalsIgnoreCase(alertStyle);
            boolean isSoundOnly = "sound_only".equalsIgnoreCase(alertStyle);
            boolean speakTitle = intent.getBooleanExtra("speak_title", false);
            if (!speakTitle && storedAlarm != null) {
                speakTitle = storedAlarm.optBoolean("speakTitle", false);
            }

            // Case 1: Sound Only - Play audio chime / speech directly, DO NOT post visual notification banner
            if (isSoundOnly) {
                Log.d(TAG, "Reminder alert style is 'sound_only'. Playing audio/speech without banner for: " + alarmId + " (" + playCount + " times)");
                final Context appContext = context.getApplicationContext();
                final PendingResult pendingResult = goAsync();
                final Handler safetyHandler = new Handler(Looper.getMainLooper());
                final boolean[] isFinished = new boolean[]{false};
                final Runnable finishRunnable = () -> {
                    if (!isFinished[0]) {
                        isFinished[0] = true;
                        try { pendingResult.finish(); } catch (Exception ignore) {}
                    }
                };
                // Ensure broadcast finishes well before system 10s ANR timeout
                safetyHandler.postDelayed(finishRunnable, 8000L);

                if (speakTitle) {
                    TTSManager.speakSequence(appContext, title, playCount, false, () -> {
                        safetyHandler.removeCallbacks(finishRunnable);
                        finishRunnable.run();
                    });
                } else {
                    playNotificationSound(appContext, soundId, playCount, () -> {
                        safetyHandler.removeCallbacks(finishRunnable);
                        finishRunnable.run();
                    });
                }
                return;
            }

            // Case 2 & 3: Banner is required ("banner_only" or "both")
            // Resolve sound URI for the notification channel & builder
            Uri soundUri = null;
            File customFile = SoundManager.getCustomSoundFile(context, soundId);
            boolean isCustom = (customFile != null && customFile.exists());

            // If alert style has sound and NOT speaking title:
            // If playCount == 1 and using a standard preset sound, let the system notification channel play it.
            // If playCount > 1 or using custom sound, channel stays silent and playNotificationSound handles repetition with 2s gap.
            if (!isBannerOnly && !speakTitle) {
                if (playCount == 1 && !isCustom) {
                    int rawRes = SoundManager.getPresetRawResource(soundId);
                    if (rawRes != 0) {
                        soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + rawRes);
                    } else {
                        soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    }
                }
            }

            createReminderNotificationChannel(context, nm, soundUri);

            // Tap notification opens the app
            Intent tapIntent = new Intent(context, MainActivity.class);
            tapIntent.putExtra("reminder_id", alarmId);
            tapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            int reqCode = Math.abs((alarmId + "_tap").hashCode());
            PendingIntent tapPendingIntent = PendingIntent.getActivity(context, reqCode, tapIntent, flags);

            int notifId = Math.abs(alarmId.hashCode());
            String bodyText = (note != null && !note.isEmpty()) ? note : "Life Tracker Reminder";

            // Snooze action
            Intent snoozeIntent = new Intent(context, AlarmActionReceiver.class);
            snoozeIntent.setAction(AlarmService.ACTION_SNOOZE_ALARM);
            snoozeIntent.putExtra("alarm_id", alarmId);
            PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(context, Math.abs((alarmId + "_snooze").hashCode()), snoozeIntent, flags);

            // Dismiss action
            Intent dismissIntent = new Intent(context, AlarmActionReceiver.class);
            dismissIntent.setAction(AlarmService.ACTION_DISMISS_ALARM);
            dismissIntent.putExtra("alarm_id", alarmId);
            PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(context, Math.abs((alarmId + "_dismiss").hashCode()), dismissIntent, flags);

            // Pause action
            Intent pauseIntent = new Intent(context, AlarmActionReceiver.class);
            pauseIntent.setAction(AlarmService.ACTION_PAUSE_ALARM);
            pauseIntent.putExtra("alarm_id", alarmId);
            PendingIntent pausePendingIntent = PendingIntent.getBroadcast(context, Math.abs((alarmId + "_pause").hashCode()), pauseIntent, flags);

            long estimatedPerPlay = speakTitle ? 3000L : 1200L;
            long bannerTimeoutMs = Math.max(5000L, (playCount * estimatedPerPlay) + ((playCount - 1) * 2000L) + 3000L);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, REMINDER_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("🔔 " + title)
                .setContentText(bodyText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(bodyText))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setTimeoutAfter(bannerTimeoutMs)
                .setContentIntent(tapPendingIntent)
                .addAction(R.drawable.ic_notification, "SNOOZE (5m)", snoozePendingIntent)
                .addAction(R.drawable.ic_notification, "DISMISS", dismissPendingIntent)
                .addAction(R.drawable.ic_notification, "PAUSE", pausePendingIntent);

            if (soundUri != null) {
                builder.setSound(soundUri);
                builder.setVibrate(new long[]{0, 250, 200, 250});
                builder.setDefaults(NotificationCompat.DEFAULT_LIGHTS);
            } else if (isBannerOnly) {
                builder.setSilent(true);
            }

            nm.notify(notifId, builder.build());

            final Context appContext = context.getApplicationContext();
            if (speakTitle) {
                // If text-to-speech is enabled, keep CPU awake and speak title via goAsync
                final PendingResult pendingResult = goAsync();
                final Handler safetyHandler = new Handler(Looper.getMainLooper());
                final boolean[] isFinished = new boolean[]{false};
                final Runnable finishRunnable = () -> {
                    if (!isFinished[0]) {
                        isFinished[0] = true;
                        try { pendingResult.finish(); } catch (Exception ignore) {}
                    }
                };
                safetyHandler.postDelayed(finishRunnable, 8000L);

                TTSManager.speakSequence(appContext, title, playCount, false, () -> {
                    safetyHandler.removeCallbacks(finishRunnable);
                    finishRunnable.run();
                });
            } else if (!isBannerOnly) {
                // If playCount > 1 or custom sound was selected: play repeated notification sound sequence
                if (playCount > 1 || isCustom) {
                    final PendingResult pendingResult = goAsync();
                    final Handler safetyHandler = new Handler(Looper.getMainLooper());
                    final boolean[] isFinished = new boolean[]{false};
                    final Runnable finishRunnable = () -> {
                        if (!isFinished[0]) {
                            isFinished[0] = true;
                            try { pendingResult.finish(); } catch (Exception ignore) {}
                        }
                    };
                    safetyHandler.postDelayed(finishRunnable, 8000L);

                    playNotificationSound(appContext, soundId, playCount, () -> {
                        safetyHandler.removeCallbacks(finishRunnable);
                        finishRunnable.run();
                    });
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error posting reminder notification", e);
        }
    }

    private static boolean setupMediaPlayerSource(Context context, MediaPlayer mp, String soundId) {
        boolean sourceSet = false;
        // 1. Check if user selected custom uploaded sound
        File customFile = SoundManager.getCustomSoundFile(context, soundId);
        if (customFile != null && customFile.exists()) {
            try {
                mp.setDataSource(customFile.getAbsolutePath());
                sourceSet = true;
                Log.d(TAG, "Playing custom notification sound: " + customFile.getAbsolutePath());
            } catch (Exception ex) {
                Log.w(TAG, "Failed to load custom notification sound", ex);
            }
        }

        // 2. Check if user selected preset sound
        if (!sourceSet) {
            int rawRes = SoundManager.getPresetRawResource(soundId);
            if (rawRes != 0) {
                try {
                    Uri rawUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + rawRes);
                    mp.setDataSource(context, rawUri);
                    sourceSet = true;
                    Log.d(TAG, "Playing preset notification sound: " + soundId);
                } catch (Exception ex) {
                    Log.w(TAG, "Failed to load preset sound", ex);
                }
            }
        }

        // 3. Fallback to default notification ringtone
        if (!sourceSet) {
            Uri defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (defaultUri != null) {
                try {
                    mp.setDataSource(context, defaultUri);
                    sourceSet = true;
                } catch (Exception ignore) {}
            }
        }
        return sourceSet;
    }

    public static synchronized void stopNotificationSound() {
        sIsSoundPlaying = false;
        if (sSoundHandler != null && sNextPlayRunnable != null) {
            sSoundHandler.removeCallbacks(sNextPlayRunnable);
            sNextPlayRunnable = null;
        }
        if (sCurrentMediaPlayer != null) {
            try {
                if (sCurrentMediaPlayer.isPlaying()) {
                    sCurrentMediaPlayer.stop();
                }
                sCurrentMediaPlayer.release();
            } catch (Exception ignore) {}
            sCurrentMediaPlayer = null;
        }
        if (sSoundWakeLock != null) {
            try {
                if (sSoundWakeLock.isHeld()) {
                    sSoundWakeLock.release();
                }
            } catch (Exception ignore) {}
            sSoundWakeLock = null;
        }
        TTSManager.stop();
        Log.d(TAG, "Notification sound stopped and cleaned up.");
    }

    public interface OnSoundProgressListener {
        void onProgress(int current, int total);
    }

    public static synchronized void playNotificationSound(Context context, String soundId, int totalPlays, Runnable onComplete) {
        playNotificationSound(context, soundId, totalPlays, null, onComplete);
    }

    public static synchronized void playNotificationSound(Context context, String soundId, int totalPlays, OnSoundProgressListener progressListener, Runnable onComplete) {
        stopNotificationSound();

        final int count = Math.max(1, totalPlays);
        if (count <= 1) {
            if (progressListener != null) {
                try { progressListener.onProgress(1, 1); } catch (Exception ignore) {}
            }
            playNotificationSoundOnce(context, soundId, onComplete);
            return;
        }

        sIsSoundPlaying = true;
        if (sSoundHandler == null) {
            sSoundHandler = new Handler(Looper.getMainLooper());
        }

        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                sSoundWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LifeTracker:NotificationSequenceWakeLock");
                long maxLockDuration = Math.min(60000L, count * 5000L);
                sSoundWakeLock.acquire(maxLockDuration);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire wake lock for notification sound sequence", e);
        }

        final int[] playIndex = new int[]{0};

        final Runnable playStep = new Runnable() {
            @Override
            public void run() {
                if (!sIsSoundPlaying) {
                    if (onComplete != null) onComplete.run();
                    return;
                }

                playIndex[0]++;
                Log.d(TAG, "Playing notification sound sequence iteration " + playIndex[0] + " of " + count);

                if (progressListener != null) {
                    try {
                        progressListener.onProgress(playIndex[0], count);
                    } catch (Exception ignore) {}
                }

                try {
                    MediaPlayer mp = new MediaPlayer();
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                    mp.setAudioAttributes(audioAttributes);
                    mp.setLooping(false);

                    boolean sourceSet = setupMediaPlayerSource(context, mp, soundId);
                    if (!sourceSet) {
                        mp.release();
                        stopNotificationSound();
                        if (onComplete != null) onComplete.run();
                        return;
                    }

                    sCurrentMediaPlayer = mp;
                    mp.prepare();
                    mp.start();
                    mp.setOnCompletionListener(mediaPlayer -> {
                        try { mediaPlayer.release(); } catch (Exception ignore) {}
                        if (sCurrentMediaPlayer == mediaPlayer) {
                            sCurrentMediaPlayer = null;
                        }

                        if (!sIsSoundPlaying) {
                            stopNotificationSound();
                            if (onComplete != null) onComplete.run();
                            return;
                        }

                        if (playIndex[0] >= count) {
                            // Reached configured play count, stop!
                            stopNotificationSound();
                            if (onComplete != null) onComplete.run();
                        } else {
                            // Fixed 2-second (2000 ms) gap before next play
                            sNextPlayRunnable = () -> {
                                sNextPlayRunnable = null;
                                run();
                            };
                            sSoundHandler.postDelayed(sNextPlayRunnable, 2000L);
                        }
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Error playing notification sound iteration " + playIndex[0], e);
                    stopNotificationSound();
                    if (onComplete != null) onComplete.run();
                }
            }
        };

        playStep.run();
    }

    public static void playNotificationSoundOnce(Context context, String soundId) {
        playNotificationSoundOnce(context, soundId, null);
    }

    public static void playNotificationSoundOnce(Context context, String soundId, Runnable onComplete) {
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            PowerManager.WakeLock soundWakeLock = null;
            if (pm != null) {
                soundWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LifeTracker:NotificationSoundWakeLock");
                soundWakeLock.acquire(8000); // 8 seconds max
            }

            MediaPlayer mp = new MediaPlayer();
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mp.setAudioAttributes(audioAttributes);
            mp.setLooping(false);

            boolean sourceSet = setupMediaPlayerSource(context, mp, soundId);
            final PowerManager.WakeLock finalWl = soundWakeLock;
            if (sourceSet) {
                sCurrentMediaPlayer = mp;
                mp.prepare();
                mp.start();
                mp.setOnCompletionListener(mediaPlayer -> {
                    try { mediaPlayer.release(); } catch (Exception ignore) {}
                    if (sCurrentMediaPlayer == mediaPlayer) sCurrentMediaPlayer = null;
                    try { if (finalWl != null && finalWl.isHeld()) finalWl.release(); } catch (Exception ignore) {}
                    if (onComplete != null) onComplete.run();
                });
            } else {
                mp.release();
                if (finalWl != null && finalWl.isHeld()) finalWl.release();
                if (onComplete != null) onComplete.run();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing notification sound once", e);
            if (onComplete != null) onComplete.run();
        }
    }

    private void createReminderNotificationChannel(Context context, NotificationManager nm, Uri soundUri) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                nm.deleteNotificationChannel("life_tracker_reminder_channel");
                nm.deleteNotificationChannel("life_tracker_reminder_channel_v2");
                nm.deleteNotificationChannel("life_tracker_reminder_channel_v3");
                nm.deleteNotificationChannel("life_tracker_reminder_channel_v4");
            } catch (Exception ignore) {}

            NotificationChannel channel = new NotificationChannel(
                REMINDER_CHANNEL_ID,
                "Life Tracker Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Standard reminder notifications");
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 250, 200, 250});
            channel.enableLights(true);

            if (soundUri != null) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
                channel.setSound(soundUri, audioAttributes);
            } else {
                channel.setSound(null, null);
            }

            nm.createNotificationChannel(channel);
        }
    }
}
