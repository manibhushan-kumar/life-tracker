package com.lifetracker.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.util.List;

@CapacitorPlugin(name = "AlarmPlugin")
public class AlarmPlugin extends Plugin {
    private static final String TAG = "LifeTrackerAlarm";
    private static AlarmPlugin sInstance = null;

    @Override
    public void load() {
        super.load();
        sInstance = this;
    }

    public static void emitAlarmEvent(String eventName, String alarmId) {
        if (sInstance != null) {
            try {
                JSObject ret = new JSObject();
                ret.put("id", alarmId);
                ret.put("event", eventName);
                sInstance.notifyListeners(eventName, ret);
            } catch (Exception e) {
                Log.e(TAG, "Error emitting alarm event", e);
            }
        }
    }

    @PluginMethod
    public void setAlarm(PluginCall call) {
        try {
            String id = call.getString("id");
            if (id == null || id.isEmpty()) {
                call.reject("Alarm ID is required");
                return;
            }

            Long timestamp = call.getLong("timestamp");
            if (timestamp == null || timestamp <= 0) {
                // If timestamp not provided, try parsing date string
                String dateStr = call.getString("datetime");
                if (dateStr != null) {
                    try {
                        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm", java.util.Locale.getDefault());
                        java.util.Date d = sdf.parse(dateStr);
                        if (d != null) timestamp = d.getTime();
                    } catch (Exception ignore) {}
                }
            }

            if (timestamp == null || timestamp <= 0) {
                call.reject("Valid timestamp or datetime is required");
                return;
            }

            String title = call.getString("title", "Reminder Alarm");
            String note = call.getString("note", "");
            String repeat = call.getString("repeat", "None");
            String soundId = call.getString("soundId", "default");
            String soundData = call.getString("soundData");
            Integer customInterval = call.getInt("customInterval", 1);
            String customUnit = call.getString("customUnit", "days");
            String mode = call.getString("mode", "alarm");
            String alertStyle = call.getString("alertStyle", "both");
            Boolean speakTitle = call.getBoolean("speakTitle", false);
            Integer playCount = call.getInt("playCount", 1);

            // Save custom sound audio if provided
            if (soundData != null && !soundData.isEmpty() && soundId != null) {
                SoundManager.saveCustomSound(getContext(), soundId, soundData);
            }

            JSONObject alarm = new JSONObject();
            alarm.put("id", id);
            alarm.put("title", title);
            alarm.put("note", note);
            alarm.put("timestamp", timestamp);
            alarm.put("repeat", repeat);
            alarm.put("soundId", soundId);
            alarm.put("customInterval", customInterval != null ? customInterval : 1);
            alarm.put("customUnit", customUnit);
            alarm.put("mode", mode);
            alarm.put("alertStyle", alertStyle);
            alarm.put("speakTitle", speakTitle != null && speakTitle);
            alarm.put("playCount", playCount != null && playCount > 0 ? playCount : 1);

            AlarmScheduler.scheduleAlarm(getContext(), alarm);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("id", id);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "setAlarm failed", e);
            call.reject("Failed to schedule alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        try {
            String id = call.getString("id");
            if (id == null || id.isEmpty()) {
                call.reject("Alarm ID is required");
                return;
            }
            AlarmScheduler.cancelAlarm(getContext(), id);
            AlarmService.stopAlarm(getContext());
            AlarmReceiver.stopNotificationSound();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "cancelAlarm failed", e);
            call.reject("Failed to cancel alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isAppForeground(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isForeground", MainActivity.isForeground());
        call.resolve(ret);
    }

    @PluginMethod
    public void snoozeAlarm(PluginCall call) {
        try {
            String id = call.getString("id");
            int minutes = call.getInt("minutes", 5);
            AlarmService.stopAlarm(getContext());
            AlarmReceiver.stopNotificationSound();
            if (id != null) {
                AlarmScheduler.snoozeAlarm(getContext(), id, minutes);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "snoozeAlarm failed", e);
            call.reject("Failed to snooze alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopAlarm(PluginCall call) {
        try {
            AlarmService.stopAlarm(getContext());
            AlarmReceiver.stopNotificationSound();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "stopAlarm failed", e);
            call.reject("Failed to stop alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveCustomSound(PluginCall call) {
        try {
            String id = call.getString("id");
            String data = call.getString("data");
            if (id == null || data == null) {
                call.reject("Sound ID and audio data are required");
                return;
            }
            boolean ok = SoundManager.saveCustomSound(getContext(), id, data);
            JSObject ret = new JSObject();
            ret.put("success", ok);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "saveCustomSound failed", e);
            call.reject("Failed to save custom sound: " + e.getMessage());
        }
    }

    @PluginMethod
    public void deleteCustomSound(PluginCall call) {
        try {
            String id = call.getString("id");
            if (id != null) {
                SoundManager.deleteCustomSound(getContext(), id);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "deleteCustomSound failed", e);
            call.reject("Failed to delete custom sound: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        boolean canSchedule = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                canSchedule = am.canScheduleExactAlarms();
            }
        }
        JSObject ret = new JSObject();
        ret.put("canSchedule", canSchedule);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "openAlarmSettings failed", e);
            call.reject("Failed to open alarm settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingAlarms(PluginCall call) {
        try {
            List<JSONObject> list = AlarmsStorage.getAllAlarms(getContext());
            JSArray arr = new JSArray();
            for (JSONObject obj : list) {
                arr.put(new JSObject(obj.toString()));
            }
            JSObject ret = new JSObject();
            ret.put("alarms", arr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get pending alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkAlarmPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        boolean exactAlarm = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                exactAlarm = am.canScheduleExactAlarms();
            }
        }
        ret.put("canScheduleExactAlarms", exactAlarm);

        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        boolean notifEnabled = nm != null && nm.areNotificationsEnabled();
        ret.put("notificationsEnabled", notifEnabled);

        boolean canUseFsi = true;
        if (Build.VERSION.SDK_INT >= 34) { // Android 14+
            if (nm != null) {
                canUseFsi = nm.canUseFullScreenIntent();
            }
        }
        ret.put("canUseFullScreenIntent", canUseFsi);

        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open notification settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        try {
            String text = call.getString("text");
            boolean isAlarm = call.getBoolean("isAlarm", false);
            int playCount = call.getInt("playCount", 1);
            if (playCount < 1) playCount = 1;

            if (text == null || text.trim().isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
                return;
            }
            TTSManager.speakSequence(getContext(), text, playCount, isAlarm, (current, total) -> {
                JSObject progress = new JSObject();
                progress.put("current", current);
                progress.put("total", total);
                progress.put("isVoice", true);
                notifyListeners("alertProgress", progress);
            }, () -> {
                JSObject done = new JSObject();
                done.put("finished", true);
                notifyListeners("alertFinished", done);

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            });
        } catch (Exception e) {
            Log.e(TAG, "Native speak failed", e);
            call.reject("Failed to speak: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopSpeech(PluginCall call) {
        try {
            TTSManager.stop();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop speech: " + e.getMessage());
        }
    }

    @PluginMethod
    public void playSound(PluginCall call) {
        try {
            String soundId = call.getString("soundId", "default");
            int playCount = call.getInt("playCount", 1);
            if (playCount < 1) playCount = 1;

            AlarmReceiver.playNotificationSound(getContext(), soundId, playCount, (current, total) -> {
                JSObject progress = new JSObject();
                progress.put("current", current);
                progress.put("total", total);
                progress.put("isVoice", false);
                notifyListeners("alertProgress", progress);
            }, () -> {
                JSObject done = new JSObject();
                done.put("finished", true);
                notifyListeners("alertFinished", done);

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            });
        } catch (Exception e) {
            Log.e(TAG, "playSound failed", e);
            call.reject("Failed to play sound: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopSound(PluginCall call) {
        try {
            AlarmReceiver.stopNotificationSound();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "stopSound failed", e);
            call.reject("Failed to stop sound: " + e.getMessage());
        }
    }
}
