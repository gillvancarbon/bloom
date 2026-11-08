package com.bloom.habittracker;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
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

/**
 * Owns the Android notification channel and plays short preview/ding sounds.
 *
 * The stock LocalNotifications plugin can only set a channel sound from a
 * bundled `res/raw` file, so it can't offer device ringtones. This plugin builds
 * the channel itself (any ringtone URI) and plays the same sounds in-app.
 * Channel sound is immutable, so the channel id is derived from the chosen
 * sound — changing the sound builds a fresh channel and removes the old ones.
 */
@CapacitorPlugin(name = "BloomSound")
public class BloomSoundPlugin extends Plugin {

    private static final String TAG = "BloomSound";
    private static final String CHANNEL_NAME = "Habit reminders";
    private static final String CHANNEL_DESC = "Gentle nudges to keep your habits on track.";
    private static final String CHANNEL_PREFIX = "bloom-reminders";
    private static final String CHIME_ID = "bloom_chime";

    @PluginMethod
    public void listSounds(PluginCall call) {
        JSArray sounds = new JSArray();
        sounds.put(option(CHIME_ID, "Bloom chime (default)"));
        sounds.put(option("default", "Phone default"));
        sounds.put(option("none", "None"));

        try {
            RingtoneManager manager = new RingtoneManager(getContext());
            manager.setType(RingtoneManager.TYPE_NOTIFICATION);
            Cursor cursor = manager.getCursor();
            while (cursor != null && cursor.moveToNext()) {
                String title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX);
                Uri uri = manager.getRingtoneUri(cursor.getPosition());
                if (uri != null && title != null) {
                    sounds.put(option(uri.toString(), title.trim()));
                }
            }
            if (cursor != null) cursor.close();
        } catch (Exception e) {
            Log.w(TAG, "Could not list ringtones", e);
        }

        JSObject ret = new JSObject();
        ret.put("sounds", sounds);
        call.resolve(ret);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String id = call.getString("id", CHIME_ID);
        Uri uri = resolveUri(id);
        if (uri == null) {
            call.resolve();
            return;
        }
        MediaPlayer player = null;
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build());
            player.setDataSource(getContext(), uri);
            player.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mp) {
                    mp.release();
                }
            });
            player.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override
                public boolean onError(MediaPlayer mp, int what, int extra) {
                    mp.release();
                    return true;
                }
            });
            player.prepare();
            player.start();
        } catch (Exception e) {
            Log.w(TAG, "Could not play sound " + id, e);
            // Release a player whose setup (setDataSource/prepare/start) failed,
            // otherwise it leaks the native player and its file descriptor.
            if (player != null) {
                player.release();
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void getChannelId(PluginCall call) {
        String sound = call.getString("sound", CHIME_ID);
        JSObject ret = new JSObject();
        ret.put("channelId", ensureChannel(sound));
        call.resolve(ret);
    }

    @PluginMethod
    public void setReminderSound(PluginCall call) {
        String sound = call.getString("sound", CHIME_ID);
        JSObject ret = new JSObject();
        ret.put("channelId", ensureChannel(sound));
        call.resolve(ret);
    }

    /** Create (or reuse) the reminder channel for `sound` and return its id. */
    private String ensureChannel(String sound) {
        String channelId = channelIdFor(sound);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return channelId;
        }
        NotificationManager manager =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return channelId;
        }

        // A channel's sound can't be changed after creation, so drop our other
        // channels when the chosen sound changes and let Android build a fresh one.
        for (NotificationChannel existing : manager.getNotificationChannels()) {
            if (existing.getId().startsWith(CHANNEL_PREFIX)
                    && !existing.getId().equals(channelId)) {
                manager.deleteNotificationChannel(existing.getId());
            }
        }

        NotificationChannel channel = new NotificationChannel(
                channelId, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(CHANNEL_DESC);
        Uri uri = resolveUri(sound);
        if (uri == null) {
            channel.setSound(null, null);
        } else {
            channel.setSound(uri, new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build());
        }
        // Bloom is deliberately silent on the haptic front — reminders should
        // never buzz the phone.
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
        return channelId;
    }

    /** A stable channel id for a sound, so the same sound reuses its channel. */
    private String channelIdFor(String sound) {
        String key = sound == null || sound.isEmpty() ? CHIME_ID : sound;
        return CHANNEL_PREFIX + "-v4-" + Integer.toHexString(key.hashCode());
    }

    /** Resolve a stored sound id to a playable URI, or null for silence. */
    private Uri resolveUri(String id) {
        if (id == null || id.isEmpty() || "none".equals(id)) return null;
        if (CHIME_ID.equals(id)) {
            return Uri.parse(
                    "android.resource://" + getContext().getPackageName() + "/raw/" + CHIME_ID);
        }
        if ("default".equals(id)) {
            return Settings.System.DEFAULT_NOTIFICATION_URI;
        }
        try {
            return Uri.parse(id);
        } catch (Exception e) {
            return null;
        }
    }

    private JSObject option(String id, String title) {
        JSObject option = new JSObject();
        option.put("id", id);
        option.put("title", title);
        return option;
    }
}
