package com.lifetracker.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.widget.Toast;

public class AlarmActionReceiver extends BroadcastReceiver {
    private static final String TAG = "LifeTrackerAlarm";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String alarmId = intent.getStringExtra("alarm_id");

        Log.d(TAG, "AlarmActionReceiver received action: " + action + " for id: " + alarmId);

        // Immediately stop continuous audio and notification
        AlarmService.stopAlarm(context);

        if (alarmId != null) {
            android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(Math.abs(alarmId.hashCode()));
                nm.cancel(AlarmService.NOTIFICATION_ID);
            }
        }

        if (AlarmService.ACTION_DISMISS_ALARM.equals(action)) {
            if (alarmId != null && !alarmId.startsWith("test_")) {
                AlarmScheduler.handleAlarmDismissed(context, alarmId);
            }
            Toast.makeText(context, "Alarm dismissed", Toast.LENGTH_SHORT).show();
            AlarmPlugin.emitAlarmEvent("alarmDismissed", alarmId);
        } else if (AlarmService.ACTION_SNOOZE_ALARM.equals(action)) {
            if (alarmId != null && !alarmId.startsWith("test_")) {
                AlarmScheduler.snoozeAlarm(context, alarmId, 5);
            }
            Toast.makeText(context, "Alarm snoozed for 5 minutes", Toast.LENGTH_SHORT).show();
            AlarmPlugin.emitAlarmEvent("alarmSnoozed", alarmId);
        } else if (AlarmService.ACTION_PAUSE_ALARM.equals(action)) {
            if (alarmId != null && !alarmId.startsWith("test_")) {
                AlarmScheduler.cancelAlarm(context, alarmId);
            }
            Toast.makeText(context, "Alarm paused", Toast.LENGTH_SHORT).show();
            AlarmPlugin.emitAlarmEvent("alarmPaused", alarmId);
        }
    }
}
