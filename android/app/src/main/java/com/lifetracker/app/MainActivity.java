package com.lifetracker.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static volatile boolean sIsForeground = false;

    public static boolean isForeground() {
        return sIsForeground;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        sIsForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        sIsForeground = false;
    }

    @Override
    public void onDestroy() {
        sIsForeground = false;
        super.onDestroy();
    }
}
