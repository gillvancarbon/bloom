package com.bloom.habittracker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BloomBarsPlugin.class);
        registerPlugin(BloomWidgetPlugin.class);
        registerPlugin(BloomSoundPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
