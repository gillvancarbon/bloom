package com.bloom.habittracker;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Small helper plugin that colours the Android navigation bar so it blends
 * with the app background instead of flashing white.
 *
 * The @capacitor/status-bar plugin only touches the status bar, so we handle
 * the navigation bar (and its icon tint) ourselves. Called from the web layer
 * whenever the light/dark theme changes and once on startup.
 */
@CapacitorPlugin(name = "BloomBars")
public class BloomBarsPlugin extends Plugin {

    @PluginMethod
    public void setNavigationBar(PluginCall call) {
        final String colorHex = call.getString("color", "#121613");
        final boolean lightIcons = Boolean.TRUE.equals(call.getBoolean("light", false));

        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity attached");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Window window = activity.getWindow();
                window.setNavigationBarColor(Color.parseColor(colorHex));

                // On Android 10+ the system paints a translucent scrim over the
                // navigation bar for contrast, which is what makes it look washed
                // out / white. Turning that off lets our colour show through.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    window.setNavigationBarContrastEnforced(false);
                }

                applyIconTheme(window, lightIcons);
                call.resolve();
            } catch (IllegalArgumentException e) {
                call.reject("Invalid colour: " + colorHex, e);
            } catch (Exception e) {
                call.reject(e.getMessage(), e);
            }
        });
    }

    private void applyIconTheme(Window window, boolean lightIcons) {
        View decor = window.getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int appearance = WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(lightIcons ? appearance : 0, appearance);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            int flags = decor.getSystemUiVisibility();
            if (lightIcons) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            } else {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            decor.setSystemUiVisibility(flags);
        }
    }
}
