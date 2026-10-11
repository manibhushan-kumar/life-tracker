package com.lifetracker.app;

import android.content.Context;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;

public class SoundManager {
    private static final String SOUNDS_DIR = "alarm_sounds";

    private static File getSoundDir(Context context) {
        File dir = new File(context.getFilesDir(), SOUNDS_DIR);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    public static boolean saveCustomSound(Context context, String soundId, String base64Data) {
        if (soundId == null || soundId.isEmpty() || base64Data == null || base64Data.isEmpty()) {
            return false;
        }
        try {
            String b64 = base64Data;
            int commaIdx = b64.indexOf(",");
            if (commaIdx >= 0) {
                b64 = b64.substring(commaIdx + 1);
            }
            byte[] bytes = Base64.decode(b64.trim(), Base64.DEFAULT);

            File soundFile = new File(getSoundDir(context), soundId + ".audio");
            try (FileOutputStream fos = new FileOutputStream(soundFile)) {
                fos.write(bytes);
                fos.flush();
            }
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    public static File getCustomSoundFile(Context context, String soundId) {
        if (soundId == null || soundId.isEmpty()) return null;
        File file = new File(getSoundDir(context), soundId + ".audio");
        return file.exists() ? file : null;
    }

    public static void deleteCustomSound(Context context, String soundId) {
        if (soundId == null || soundId.isEmpty()) return;
        File file = new File(getSoundDir(context), soundId + ".audio");
        if (file.exists()) {
            file.delete();
        }
    }

    public static int getPresetRawResource(String soundId) {
        if (soundId == null) return R.raw.sound_alarm_chime;
        switch (soundId) {
            case "bell":
                return R.raw.sound_alarm_bell;
            case "digital":
                return R.raw.sound_alarm_digital;
            case "marimba":
                return R.raw.sound_alarm_marimba;
            case "chime":
            case "default":
                return R.raw.sound_alarm_chime;
            default:
                return 0; // Not a preset
        }
    }
}
