package com.lifetracker.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class AlarmsStorage {
    private static final String PREFS_NAME = "life_tracker_alarms_prefs";
    private static final String KEY_ALARMS = "alarms_json";

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static synchronized void saveAlarm(Context context, JSONObject alarm) {
        try {
            String id = alarm.optString("id");
            if (id.isEmpty()) return;

            List<JSONObject> list = getAllAlarms(context);
            boolean replaced = false;
            for (int i = 0; i < list.size(); i++) {
                if (id.equals(list.get(i).optString("id"))) {
                    list.set(i, alarm);
                    replaced = true;
                    break;
                }
            }
            if (!replaced) {
                list.add(alarm);
            }

            JSONArray arr = new JSONArray();
            for (JSONObject item : list) {
                arr.put(item);
            }
            getPrefs(context).edit().putString(KEY_ALARMS, arr.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static synchronized void removeAlarm(Context context, String id) {
        try {
            if (id == null || id.isEmpty()) return;
            List<JSONObject> list = getAllAlarms(context);
            JSONArray arr = new JSONArray();
            for (JSONObject item : list) {
                if (!id.equals(item.optString("id"))) {
                    arr.put(item);
                }
            }
            getPrefs(context).edit().putString(KEY_ALARMS, arr.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static synchronized JSONObject getAlarm(Context context, String id) {
        if (id == null || id.isEmpty()) return null;
        List<JSONObject> list = getAllAlarms(context);
        for (JSONObject item : list) {
            if (id.equals(item.optString("id"))) {
                return item;
            }
        }
        return null;
    }

    public static synchronized List<JSONObject> getAllAlarms(Context context) {
        List<JSONObject> result = new ArrayList<>();
        try {
            String json = getPrefs(context).getString(KEY_ALARMS, "[]");
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                result.add(arr.getJSONObject(i));
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return result;
    }
}
