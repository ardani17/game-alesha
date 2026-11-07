package com.ardani.gamealesha;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // plugin lokal: pembaruan in-app dari GitHub Releases
        registerPlugin(InstallApkPlugin.class);
    }
}
