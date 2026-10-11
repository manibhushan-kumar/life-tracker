package com.lifetracker.app;

import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmActivity extends AppCompatActivity {
    private String mAlarmId;
    private String mTitle;
    private String mNote;
    private String mRepeat;

    private TextView mTvTime;
    private TextView mTvAmPm;
    private TextView mTvDate;
    private TextView mTvTitle;
    private TextView mTvNote;
    private TextView mTvRepeat;
    private View mFlIconContainer;

    private Handler mClockHandler;
    private Runnable mClockRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn screen on and show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        }

        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );

        setContentView(R.layout.activity_alarm);

        Intent intent = getIntent();
        if (intent != null) {
            mAlarmId = intent.getStringExtra("alarm_id");
            mTitle = intent.getStringExtra("title");
            mNote = intent.getStringExtra("note");
            mRepeat = intent.getStringExtra("repeat");
        }
        if (mAlarmId == null) {
            mAlarmId = AlarmService.getCurrentAlarmId();
        }
        if (mTitle == null || mTitle.isEmpty()) mTitle = "Reminder Alarm";
        if (mNote == null) mNote = "";
        if (mRepeat == null || mRepeat.isEmpty() || "None".equalsIgnoreCase(mRepeat)) {
            mRepeat = "One-time Alarm";
        } else {
            mRepeat = "Repeats: " + mRepeat;
        }

        mTvTime = findViewById(R.id.tvAlarmTime);
        mTvAmPm = findViewById(R.id.tvAlarmAmPm);
        mTvDate = findViewById(R.id.tvAlarmDate);
        mTvTitle = findViewById(R.id.tvAlarmTitle);
        mTvNote = findViewById(R.id.tvAlarmNote);
        mTvRepeat = findViewById(R.id.tvAlarmRepeat);
        mFlIconContainer = findViewById(R.id.flIconContainer);

        mTvTitle.setText(mTitle);
        if (mNote.isEmpty()) {
            mTvNote.setVisibility(View.GONE);
        } else {
            mTvNote.setText(mNote);
            mTvNote.setVisibility(View.VISIBLE);
        }
        mTvRepeat.setText(mRepeat);

        Button btnSnooze = findViewById(R.id.btnSnooze);
        Button btnDismiss = findViewById(R.id.btnDismiss);
        Button btnPause = findViewById(R.id.btnPause);

        btnSnooze.setOnClickListener(v -> handleSnooze());
        btnDismiss.setOnClickListener(v -> handleDismiss());
        if (btnPause != null) {
            btnPause.setOnClickListener(v -> handlePause());
        }

        startLiveClock();
        startIconPulseAnimation();
    }

    private void startLiveClock() {
        mClockHandler = new Handler(Looper.getMainLooper());
        mClockRunnable = new Runnable() {
            @Override
            public void run() {
                updateClockDisplay();
                mClockHandler.postDelayed(this, 1000);
            }
        };
        mClockHandler.post(mClockRunnable);
    }

    private void updateClockDisplay() {
        Date now = new Date();
        SimpleDateFormat timeFormat = new SimpleDateFormat("hh:mm", Locale.getDefault());
        SimpleDateFormat ampmFormat = new SimpleDateFormat("a", Locale.getDefault());
        SimpleDateFormat dateFormat = new SimpleDateFormat("EEEE, MMMM d", Locale.getDefault());

        if (mTvTime != null) mTvTime.setText(timeFormat.format(now));
        if (mTvAmPm != null) mTvAmPm.setText(ampmFormat.format(now).toUpperCase(Locale.getDefault()));
        if (mTvDate != null) mTvDate.setText(dateFormat.format(now));
    }

    private void startIconPulseAnimation() {
        if (mFlIconContainer != null) {
            PropertyValuesHolder scaleX = PropertyValuesHolder.ofFloat(View.SCALE_X, 1.0f, 1.15f, 1.0f);
            PropertyValuesHolder scaleY = PropertyValuesHolder.ofFloat(View.SCALE_Y, 1.0f, 1.15f, 1.0f);
            ObjectAnimator pulse = ObjectAnimator.ofPropertyValuesHolder(mFlIconContainer, scaleX, scaleY);
            pulse.setDuration(1200);
            pulse.setRepeatCount(ObjectAnimator.INFINITE);
            pulse.start();
        }
    }

    private void handleSnooze() {
        AlarmService.stopAlarm(this);
        if (mAlarmId != null && !mAlarmId.isEmpty()) {
            AlarmScheduler.snoozeAlarm(this, mAlarmId, 5);
        }
        Toast.makeText(this, "Alarm snoozed for 5 minutes", Toast.LENGTH_SHORT).show();
        AlarmPlugin.emitAlarmEvent("alarmSnoozed", mAlarmId);
        finish();
    }

    private void handleDismiss() {
        AlarmService.stopAlarm(this);
        if (mAlarmId != null && !mAlarmId.isEmpty()) {
            AlarmScheduler.handleAlarmDismissed(this, mAlarmId);
        }
        Toast.makeText(this, "Alarm dismissed", Toast.LENGTH_SHORT).show();
        AlarmPlugin.emitAlarmEvent("alarmDismissed", mAlarmId);
        finish();
    }

    private void handlePause() {
        AlarmService.stopAlarm(this);
        if (mAlarmId != null && !mAlarmId.isEmpty()) {
            AlarmScheduler.cancelAlarm(this, mAlarmId);
        }
        Toast.makeText(this, "Alarm paused", Toast.LENGTH_SHORT).show();
        AlarmPlugin.emitAlarmEvent("alarmPaused", mAlarmId);
        finish();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Hardware volume keys snooze the alarm like standard phone alarms
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            handleSnooze();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            }
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    @Override
    protected void onDestroy() {
        if (mClockHandler != null && mClockRunnable != null) {
            mClockHandler.removeCallbacks(mClockRunnable);
        }
        super.onDestroy();
    }
}
