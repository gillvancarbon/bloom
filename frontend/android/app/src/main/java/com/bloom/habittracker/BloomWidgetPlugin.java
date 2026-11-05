package com.bloom.habittracker;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Receives the home-screen widget snapshot from the web layer and asks the
 * widget provider to redraw. Kept deliberately tiny: all habit logic lives in
 * TypeScript so the widget and the app can never disagree.
 */
@CapacitorPlugin(name = "BloomWidget")
public class BloomWidgetPlugin extends Plugin {

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String snapshot = call.getString("snapshot", "{}");
        Context context = getContext();
        context.getSharedPreferences(HabitWidgetProvider.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(HabitWidgetProvider.KEY_SNAPSHOT, snapshot)
                .apply();
        HabitWidgetProvider.refresh(context);
        call.resolve();
    }
}
