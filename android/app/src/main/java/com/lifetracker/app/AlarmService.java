package com.lifetracker.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.io.File;

public class AlarmService extends Service {
    private static final String TAG = "LifeTrackerAlarm";
    public static final String CHANNEL_ID = "life_tracker_alarm_channel_v4";
    public static final int NOTIFICATION_ID = 99991;

    public static final String ACTION_DISMISS_ALARM = "com.lifetracker.app.ACTION_DISMISS_ALARM";
    public static final String ACTION_SNOOZE_ALARM = "com.lifetracker.app.ACTION_SNOOZE_ALARM";
    public static final String ACTION_PAUSE_ALARM = "com.lifetracker.app.ACTION_PAUSE_ALARM";

    private static AlarmService sInstance = null;
    private static String sCurrentAlarmId = null;

    private MediaPlayer mMediaPlayer;
    private Vibrator mVibrator;
    private PowerManager.WakeLock mWakeLock;
    private Handler mHandler;
    private Runnable mAutoStopRunnable;

    public static boolean isAlarmRinging() {
        return sInstance != null;
    }

    public static String getCurrentAlarmId() {
        return sCurrentAlarmId;
    }

    public static void stopAlarm(Context context) {
        if (sInstance != null) {
            sInstance.cleanupAndStop();
        } else {
            Intent intent = new Intent(context, AlarmService.class);
            context.stopService(intent);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        mHandler = new Handler(Looper.getMainLooper());
        acquireScreenWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            try {
                createNotificationChannel();
                Notification notification = buildAlarmNotification("service_recovery", "Life Tracker Alert", "");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
            } catch (Exception ignore) {}
            stopSelf();
            return START_NOT_STICKY;
        }

        String alarmId = intent.getStringExtra("alarm_id");
        String title = intent.getStringExtra("title");
        String note = intent.getStringExtra("note");
        String soundId = intent.getStringExtra("sound_id");

        if (title == null || title.isEmpty()) title = "Reminder Alarm";
        if (note == null) note = "";
        sCurrentAlarmId = alarmId;

        // Ensure display is powered on immediately
        acquireScreenWakeLock();

        // 1. Create channel with sound and high importance (critical for full-screen lockscreen intent)
        createNotificationChannel();

        // 2. Build high-priority lock-screen notification with FullScreenIntent and action buttons
        Notification notification = buildAlarmNotification(alarmId, title, note);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground service notification", e);
        }

        // 3. Attempt direct AlarmActivity launch over the lockscreen
        launchAlarmActivity(alarmId, title, note);

        // 4. Phone Alarm: If speakTitle is enabled, speak once and then continue playing mp3!
        boolean speakTitle = intent.getBooleanExtra("speak_title", false);
        if (speakTitle) {
            TTSManager.speak(this, title, true, () -> {
                // Voice announcement finished; continue playing mp3 in loop
                if (sInstance != null) {
                    startAlarmAudio(soundId);
                }
            });
        } else {
            startAlarmAudio(soundId);
        }
        startAlarmVibration();

        // Safety: automatically snooze after 10 minutes if no user action
        mAutoStopRunnable = () -> {
            Log.w(TAG, "Alarm timed out after 10 minutes. Automatically snoozing.");
            if (sCurrentAlarmId != null) {
                AlarmScheduler.snoozeAlarm(getApplicationContext(), sCurrentAlarmId, 5);
            }
            cleanupAndStop();
        };
        mHandler.postDelayed(mAutoStopRunnable, 10 * 60 * 1000L);

        return START_STICKY;
    }

    private void acquireScreenWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                if (mWakeLock != null && mWakeLock.isHeld()) {
                    mWakeLock.release();
                }
                @SuppressWarnings("deprecation")
                int wakeFlags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                                PowerManager.ON_AFTER_RELEASE;
                mWakeLock = pm.newWakeLock(wakeFlags, "LifeTracker:AlarmServiceScreenWakeLock");
                mWakeLock.acquire(10 * 60 * 1000L); // 10 minutes max
            }
        } catch (Exception e) {
            Log.e(TAG, "Error acquiring screen wake lock", e);
        }
    }

    private void launchAlarmActivity(String alarmId, String title, String note) {
        try {
            Intent activityIntent = new Intent(this, AlarmActivity.class);
            activityIntent.putExtra("alarm_id", alarmId);
            activityIntent.putExtra("title", title);
            activityIntent.putExtra("note", note);
            activityIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            startActivity(activityIntent);
            Log.d(TAG, "AlarmActivity launched from AlarmService");
        } catch (Exception e) {
            Log.e(TAG, "Could not launch AlarmActivity directly (full-screen intent will take over)", e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Purge previous channels to ensure clean configuration
            try {
                nm.deleteNotificationChannel("life_tracker_alarm_channel");
                nm.deleteNotificationChannel("life_tracker_alarm_channel_v2");
                nm.deleteNotificationChannel("life_tracker_alarm_channel_v3");
            } catch (Exception ignore) {}

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Life Tracker Alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Critical ringing alarms with lock-screen alerts");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setBypassDnd(true);
            // Notification channel itself is SILENT: audio & vibration are managed exclusively by AlarmService MediaPlayer & Vibrator!
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.enableLights(true);
            channel.setLightColor(0xFFFF0033);

            nm.createNotificationChannel(channel);
        }
    }

    private Notification buildAlarmNotification(String alarmId, String title, String note) {
        int intentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            intentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Full-screen Activity Intent (opens lock screen UI)
        Intent fullScreenIntent = new Intent(this, AlarmActivity.class);
        fullScreenIntent.putExtra("alarm_id", alarmId);
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("note", note);
        fullScreenIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(this, 101, fullScreenIntent, intentFlags);

        // Dismiss action
        Intent dismissIntent = new Intent(this, AlarmActionReceiver.class);
        dismissIntent.setAction(ACTION_DISMISS_ALARM);
        dismissIntent.putExtra("alarm_id", alarmId);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(this, 102, dismissIntent, intentFlags);

        // Snooze action
        Intent snoozeIntent = new Intent(this, AlarmActionReceiver.class);
        snoozeIntent.setAction(ACTION_SNOOZE_ALARM);
        snoozeIntent.putExtra("alarm_id", alarmId);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(this, 103, snoozeIntent, intentFlags);

        // Pause action
        Intent pauseIntent = new Intent(this, AlarmActionReceiver.class);
        pauseIntent.setAction(ACTION_PAUSE_ALARM);
        pauseIntent.putExtra("alarm_id", alarmId);
        PendingIntent pausePendingIntent = PendingIntent.getBroadcast(this, 104, pauseIntent, intentFlags);

        String bodyText = note.isEmpty() ? "Alarm ringing • Tap to open" : note;

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("⏰ " + title)
            .setContentText(bodyText)
            .setStyle(new NotificationCompat.BigTextStyle().setBigContentTitle("⏰ " + title).bigText(bodyText))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSilent(true)
            .setSound(null)
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(R.drawable.ic_notification, "SNOOZE (5m)", snoozePendingIntent)
            .addAction(R.drawable.ic_notification, "DISMISS", dismissPendingIntent)
            .addAction(R.drawable.ic_notification, "PAUSE", pausePendingIntent)
            .build();
    }

    private void startAlarmAudio(String soundId) {
        try {
            stopAudio();

            mMediaPlayer = new MediaPlayer();

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mMediaPlayer.setAudioAttributes(audioAttributes);
            mMediaPlayer.setLooping(true);

            boolean sourceSet = false;

            // 1. Check if user selected custom uploaded sound
            File customFile = SoundManager.getCustomSoundFile(this, soundId);
            if (customFile != null && customFile.exists()) {
                try {
                    mMediaPlayer.setDataSource(customFile.getAbsolutePath());
                    sourceSet = true;
                    Log.d(TAG, "Playing custom sound file: " + customFile.getAbsolutePath());
                } catch (Exception ex) {
                    Log.w(TAG, "Failed to load custom sound, falling back to preset", ex);
                }
            }

            // 2. Check if user selected preset sound
            if (!sourceSet) {
                int rawRes = SoundManager.getPresetRawResource(soundId);
                if (rawRes != 0) {
                    try {
                        Uri rawUri = Uri.parse("android.resource://" + getPackageName() + "/" + rawRes);
                        mMediaPlayer.setDataSource(this, rawUri);
                        sourceSet = true;
                        Log.d(TAG, "Playing preset raw audio: " + soundId);
                    } catch (Exception ex) {
                        Log.w(TAG, "Failed to load preset sound, falling back to system alarm", ex);
                    }
                }
            }

            // 3. Fallback to system default alarm sound
            if (!sourceSet) {
                Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }
                mMediaPlayer.setDataSource(this, alarmUri);
                Log.d(TAG, "Playing system default alarm ringtone");
            }

            mMediaPlayer.prepare();
            mMediaPlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "Error starting alarm media player", e);
        }
    }

    private void startAlarmVibration() {
        try {
            mVibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (mVibrator != null && mVibrator.hasVibrator()) {
                long[] pattern = {0, 800, 400, 800, 400, 1000, 600};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    mVibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    mVibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting alarm vibration", e);
        }
    }

    private void stopAudio() {
        if (mMediaPlayer != null) {
            try {
                if (mMediaPlayer.isPlaying()) {
                    mMediaPlayer.stop();
                }
                mMediaPlayer.release();
            } catch (Exception ignore) {}
            mMediaPlayer = null;
        }
    }

    private void stopVibration() {
        if (mVibrator != null) {
            try {
                mVibrator.cancel();
            } catch (Exception ignore) {}
            mVibrator = null;
        }
    }

    private void cleanupAndStop() {
        if (mHandler != null && mAutoStopRunnable != null) {
            mHandler.removeCallbacks(mAutoStopRunnable);
        }
        stopAudio();
        stopVibration();

        if (mWakeLock != null && mWakeLock.isHeld()) {
            try {
                mWakeLock.release();
            } catch (Exception ignore) {}
            mWakeLock = null;
        }

        stopForeground(true);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ID);
        }

        sInstance = null;
        sCurrentAlarmId = null;
        stopSelf();
    }

    @Override
    public void onDestroy() {
        cleanupAndStop();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
