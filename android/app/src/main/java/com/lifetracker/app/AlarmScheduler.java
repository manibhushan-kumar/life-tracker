package com.lifetracker.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import org.json.JSONObject;
import java.util.Calendar;
import java.util.List;

public class AlarmScheduler {
    public static final String ACTION_ALARM_TRIGGER = "com.lifetracker.app.ACTION_ALARM_TRIGGER";
    private static final String TAG = "LifeTrackerAlarm";

    public static void scheduleAlarm(Context context, JSONObject alarm) {
        if (alarm == null) return;
        try {
            String id = alarm.optString("id");
            if (id.isEmpty()) return;

            long timestamp = alarm.optLong("timestamp", 0);
            long now = System.currentTimeMillis();

            String repeat = alarm.optString("repeat", "None");

            // If timestamp has passed and it's recurring, advance to next occurrence
            if (timestamp <= now && !"None".equalsIgnoreCase(repeat) && !repeat.isEmpty()) {
                timestamp = calculateNextOccurrence(timestamp, repeat, alarm.optInt("customInterval", 1), alarm.optString("customUnit", "days"));
                alarm.put("timestamp", timestamp);
            }

            // If still in the past (one-time alarm that already elapsed), don't schedule
            if (timestamp <= now) {
                Log.w(TAG, "Alarm time is in the past, skipping schedule for id: " + id);
                return;
            }

            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.setAction(ACTION_ALARM_TRIGGER);
            intent.putExtra("alarm_id", id);
            intent.putExtra("title", alarm.optString("title", "Reminder Alert"));
            intent.putExtra("note", alarm.optString("note", ""));
            intent.putExtra("sound_id", alarm.optString("soundId", "default"));
            intent.putExtra("repeat", repeat);
            intent.putExtra("timestamp", timestamp);
            intent.putExtra("mode", alarm.optString("mode", "alarm"));
            intent.putExtra("alert_style", alarm.optString("alertStyle", "both"));
            intent.putExtra("speak_title", alarm.optBoolean("speakTitle", false));

            int requestCode = Math.abs(id.hashCode());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent alarmPendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags);

            // Intent to launch AlarmActivity if tapped from lock screen clock
            Intent showIntent = new Intent(context, AlarmActivity.class);
            showIntent.putExtra("alarm_id", id);
            showIntent.putExtra("title", alarm.optString("title", "Reminder Alert"));
            showIntent.putExtra("note", alarm.optString("note", ""));
            showIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent showPendingIntent = PendingIntent.getActivity(context, requestCode, showIntent, flags);

            // Always use setAlarmClock for true unthrottled lock-screen wakeup
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) {
                    AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(timestamp, showPendingIntent);
                    am.setAlarmClock(clockInfo, alarmPendingIntent);
                } else {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, alarmPendingIntent);
                }
            } else {
                AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(timestamp, showPendingIntent);
                am.setAlarmClock(clockInfo, alarmPendingIntent);
            }

            // Persist to storage
            AlarmsStorage.saveAlarm(context, alarm);
            Log.d(TAG, "Scheduled alarm clock for " + id + " at millis " + timestamp);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule alarm", e);
        }
    }

    public static void cancelAlarm(Context context, String id) {
        if (id == null || id.isEmpty()) return;
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            int requestCode = Math.abs(id.hashCode());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            if (am != null) {
                Intent intent = new Intent(context, AlarmReceiver.class);
                intent.setAction(ACTION_ALARM_TRIGGER);
                PendingIntent pi = PendingIntent.getBroadcast(context, requestCode, intent, flags);
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }

                Intent showIntent = new Intent(context, AlarmActivity.class);
                PendingIntent showPi = PendingIntent.getActivity(context, requestCode, showIntent, flags);
                if (showPi != null) {
                    am.cancel(showPi);
                    showPi.cancel();
                }
            }

            // Stop alarm immediately if it is currently ringing
            AlarmService.stopAlarm(context);

            AlarmsStorage.removeAlarm(context, id);
            Log.d(TAG, "Cancelled alarm for id: " + id);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel alarm", e);
        }
    }

    public static void snoozeAlarm(Context context, String id, int minutes) {
        if (id == null || id.isEmpty()) return;
        try {
            JSONObject existing = AlarmsStorage.getAlarm(context, id);
            long snoozeTime = System.currentTimeMillis() + (minutes * 60 * 1000L);

            JSONObject snoozeObj;
            if (existing != null) {
                snoozeObj = new JSONObject(existing.toString());
            } else {
                snoozeObj = new JSONObject();
                snoozeObj.put("id", id);
                snoozeObj.put("title", "Snoozed Alert");
            }
            snoozeObj.put("timestamp", snoozeTime);
            snoozeObj.put("snoozed", true);

            scheduleAlarm(context, snoozeObj);
            Log.d(TAG, "Alarm " + id + " snoozed for " + minutes + " minutes");
        } catch (Exception e) {
            Log.e(TAG, "Failed to snooze alarm", e);
        }
    }

    public static void handleAlarmDismissed(Context context, String id) {
        if (id == null || id.isEmpty()) return;
        try {
            JSONObject alarm = AlarmsStorage.getAlarm(context, id);
            if (alarm == null) return;

            String repeat = alarm.optString("repeat", "None");
            if (!"None".equalsIgnoreCase(repeat) && !repeat.isEmpty()) {
                long currentTimestamp = alarm.optLong("timestamp", System.currentTimeMillis());
                long nextTimestamp = calculateNextOccurrence(
                    currentTimestamp,
                    repeat,
                    alarm.optInt("customInterval", 1),
                    alarm.optString("customUnit", "days")
                );
                alarm.put("timestamp", nextTimestamp);
                alarm.put("snoozed", false);
                scheduleAlarm(context, alarm);
                Log.d(TAG, "Rescheduled recurring alarm " + id + " for next occurrence: " + nextTimestamp);
            } else {
                // One-time alarm completed
                AlarmsStorage.removeAlarm(context, id);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling alarm dismissal", e);
        }
    }

    public static void rescheduleAllAlarms(Context context) {
        try {
            List<JSONObject> list = AlarmsStorage.getAllAlarms(context);
            Log.d(TAG, "Rescheduling " + list.size() + " alarms after boot/refresh");
            for (JSONObject alarm : list) {
                if (!alarm.optBoolean("paused", false)) {
                    scheduleAlarm(context, alarm);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to reschedule alarms", e);
        }
    }

    public static long calculateNextOccurrence(long fromMillis, String repeat, int customInterval, String customUnit) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(fromMillis);
        long now = System.currentTimeMillis();

        while (cal.getTimeInMillis() <= now) {
            switch (repeat.toLowerCase()) {
                case "every minute":
                    cal.add(Calendar.MINUTE, 1);
                    break;
                case "hourly":
                    cal.add(Calendar.HOUR_OF_DAY, 1);
                    break;
                case "daily":
                    cal.add(Calendar.DAY_OF_YEAR, 1);
                    break;
                case "weekly":
                    cal.add(Calendar.WEEK_OF_YEAR, 1);
                    break;
                case "monthly":
                    cal.add(Calendar.MONTH, 1);
                    break;
                case "yearly":
                    cal.add(Calendar.YEAR, 1);
                    break;
                case "custom":
                    int interval = Math.max(1, customInterval);
                    if ("minutes".equalsIgnoreCase(customUnit) || "minute".equalsIgnoreCase(customUnit)) {
                        cal.add(Calendar.MINUTE, interval);
                    } else if ("hours".equalsIgnoreCase(customUnit) || "hour".equalsIgnoreCase(customUnit)) {
                        cal.add(Calendar.HOUR_OF_DAY, interval);
                    } else if ("days".equalsIgnoreCase(customUnit) || "day".equalsIgnoreCase(customUnit)) {
                        cal.add(Calendar.DAY_OF_YEAR, interval);
                    } else if ("weeks".equalsIgnoreCase(customUnit) || "week".equalsIgnoreCase(customUnit)) {
                        cal.add(Calendar.WEEK_OF_YEAR, interval);
                    } else if ("months".equalsIgnoreCase(customUnit) || "month".equalsIgnoreCase(customUnit)) {
                        cal.add(Calendar.MONTH, interval);
                    } else {
                        cal.add(Calendar.DAY_OF_YEAR, 1);
                    }
                    break;
                default:
                    cal.add(Calendar.DAY_OF_YEAR, 1);
                    break;
            }
        }
        return cal.getTimeInMillis();
    }
}
