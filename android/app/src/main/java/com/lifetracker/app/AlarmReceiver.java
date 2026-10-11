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
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import java.io.File;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "LifeTrackerAlarm";
    public static final String REMINDER_CHANNEL_ID = "life_tracker_reminder_channel_v4";

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

        // 2. If app is currently open / in foreground: DO NOT play system notification or OS sounds!
        if (MainActivity.isForeground()) {
            Log.d(TAG, "App is open in foreground. Suppressing system notification for: " + alarmId);
            if ("notification".equalsIgnoreCase(mode)) {
                AlarmPlugin.emitAlarmEvent("reminderTriggeredForeground", alarmId);
            } else {
                AlarmPlugin.emitAlarmEvent("alarmTriggeredForeground", alarmId);
            }
            return;
        }

        // 3. App is closed or phone is locked: Trigger native alert
        if ("notification".equalsIgnoreCase(mode)) {
            // Standard notification mode: Post single notification with exactly ONE chime sound
            postReminderNotification(context, intent, storedAlarm);
        } else {
            // Phone Alarm mode: Start AlarmService (silent channel + looping MediaPlayer) & AlarmActivity
            triggerAlarmServiceAndActivity(context, intent);
        }
    }

    private void triggerAlarmServiceAndActivity(Context context, Intent intent) {
        // Acquire wake lock to illuminate locked screen
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            @SuppressWarnings("deprecation")
            int wakeFlags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                            PowerManager.ACQUIRE_CAUSES_WAKEUP |
                            PowerManager.ON_AFTER_RELEASE;
            PowerManager.WakeLock wakeLock = pm.newWakeLock(wakeFlags, "LifeTracker:AlarmReceiverWakeLock");
            wakeLock.acquire(30000); // 30 seconds
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

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            createReminderNotificationChannel(context, nm);

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

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, REMINDER_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("🔔 " + title)
                .setContentText(bodyText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(bodyText))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setSilent(true)
                .setSound(null)
                .setContentIntent(tapPendingIntent)
                .addAction(R.drawable.ic_notification, "SNOOZE (5m)", snoozePendingIntent)
                .addAction(R.drawable.ic_notification, "DISMISS", dismissPendingIntent)
                .addAction(R.drawable.ic_notification, "PAUSE", pausePendingIntent);

            nm.notify(notifId, builder.build());

            boolean speakTitle = intent.getBooleanExtra("speak_title", false);
            if (!speakTitle && storedAlarm != null) {
                speakTitle = storedAlarm.optBoolean("speakTitle", false);
            }

            if (speakTitle) {
                // If text-to-speech is enabled, play ONLY text-to-speech voice, NOT notification chime!
                TTSManager.speak(context, title, false, null);
            } else if (!"banner_only".equalsIgnoreCase(alertStyle)) {
                // Otherwise play notification chime
                playNotificationSoundOnce(context, soundId);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error posting reminder notification", e);
        }
    }

    public static void playNotificationSoundOnce(Context context, String soundId) {
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

            final PowerManager.WakeLock finalWl = soundWakeLock;
            if (sourceSet) {
                mp.prepare();
                mp.start();
                mp.setOnCompletionListener(mediaPlayer -> {
                    try { mediaPlayer.release(); } catch (Exception ignore) {}
                    try { if (finalWl != null && finalWl.isHeld()) finalWl.release(); } catch (Exception ignore) {}
                });
            } else {
                mp.release();
                if (finalWl != null && finalWl.isHeld()) finalWl.release();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing notification sound once", e);
        }
    }

    private void createReminderNotificationChannel(Context context, NotificationManager nm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                nm.deleteNotificationChannel("life_tracker_reminder_channel");
                nm.deleteNotificationChannel("life_tracker_reminder_channel_v2");
                nm.deleteNotificationChannel("life_tracker_reminder_channel_v3");
            } catch (Exception ignore) {}

            NotificationChannel channel = new NotificationChannel(
                REMINDER_CHANNEL_ID,
                "Life Tracker Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Standard reminder notifications");
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(true);
            channel.enableLights(true);
            // Notification channel is silent: audio is played directly by MediaPlayer to support custom sounds with zero duplicate audio
            channel.setSound(null, null);

            nm.createNotificationChannel(channel);
        }
    }
}
