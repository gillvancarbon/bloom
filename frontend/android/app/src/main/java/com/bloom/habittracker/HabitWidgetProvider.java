package com.bloom.habittracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget: a quiet snapshot of today's habits.
 *
 * The web layer computes the snapshot (which habits are done today) and pushes
 * it through {@link BloomWidgetPlugin}; this provider only renders it, so the
 * widget always matches the app without duplicating any streak logic in Java.
 */
public class HabitWidgetProvider extends AppWidgetProvider {

    /** Preferences file shared with {@link BloomWidgetPlugin}. */
    public static final String PREFS = "bloom.widget.v1";
    public static final String KEY_SNAPSHOT = "snapshot";

    private static final int[] ROW_IDS = {
            R.id.widget_item_1, R.id.widget_item_2, R.id.widget_item_3
    };

    private static final int[] TASK_ROW_IDS = {
            R.id.widget_task_1, R.id.widget_task_2
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        String snapshot = readSnapshot(context);
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context, snapshot));
        }
    }

    /** Re-render every placed widget. Called by the plugin after a change. */
    public static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
                new ComponentName(context, HabitWidgetProvider.class));
        if (ids.length == 0) return;
        String snapshot = readSnapshot(context);
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context, snapshot));
        }
    }

    private static String readSnapshot(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return prefs.getString(KEY_SNAPSHOT, null);
    }

    private static RemoteViews buildViews(Context context, String snapshot) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_habits);

        int done = 0;
        int total = 0;
        int taskTotal = 0;
        JSONArray items = new JSONArray();
        JSONArray taskItems = new JSONArray();
        if (snapshot != null) {
            try {
                JSONObject json = new JSONObject(snapshot);
                done = json.optInt("done", 0);
                total = json.optInt("total", 0);
                taskTotal = json.optInt("taskTotal", 0);
                JSONArray parsed = json.optJSONArray("items");
                if (parsed != null) items = parsed;
                JSONArray parsedTasks = json.optJSONArray("taskItems");
                if (parsedTasks != null) taskItems = parsedTasks;
            } catch (Exception ignored) {
                // Corrupt snapshot: fall back to the empty state.
            }
        }

        int progress = total > 0 ? Math.round(done * 100f / total) : 0;
        views.setProgressBar(R.id.widget_progress, 100, progress, false);
        views.setTextViewText(
                R.id.widget_summary,
                total == 0
                        ? context.getString(R.string.widget_empty)
                        : context.getString(R.string.widget_summary, done, total));

        for (int i = 0; i < ROW_IDS.length; i++) {
            if (i < items.length()) {
                JSONObject item = items.optJSONObject(i);
                String name = item != null ? item.optString("name", "") : "";
                boolean itemDone = item != null && item.optBoolean("done", false);
                views.setViewVisibility(ROW_IDS[i], View.VISIBLE);
                views.setTextViewText(ROW_IDS[i], (itemDone ? "✓  " : "○  ") + name);
            } else {
                views.setViewVisibility(ROW_IDS[i], View.GONE);
            }
        }

        // A quiet second section for the tasks that need attention today.
        views.setViewVisibility(
                R.id.widget_tasks_title, taskTotal > 0 ? View.VISIBLE : View.GONE);
        for (int i = 0; i < TASK_ROW_IDS.length; i++) {
            if (i < taskItems.length()) {
                views.setViewVisibility(TASK_ROW_IDS[i], View.VISIBLE);
                views.setTextViewText(TASK_ROW_IDS[i], "•  " + taskItems.optString(i, ""));
            } else {
                views.setViewVisibility(TASK_ROW_IDS[i], View.GONE);
            }
        }

        // Tapping anywhere on the widget opens Bloom.
        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context,
                0,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        return views;
    }
}
