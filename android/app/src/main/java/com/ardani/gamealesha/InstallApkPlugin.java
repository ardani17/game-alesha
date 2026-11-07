package com.ardani.gamealesha;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Plugin lokal: buka pemasang Android (package installer) untuk file APK
 * yang sudah diunduh, agar aplikasi bisa memperbarui dirinya sendiri
 * langsung dari GitHub Releases tanpa Play Store.
 *
 * Butuh permission REQUEST_INSTALL_PACKAGES (sudah di AndroidManifest) dan
 * FileProvider bawaan Capacitor (${applicationId}.fileprovider) yang
 * mencakup cache-path.
 */
@CapacitorPlugin(name = "InstallApk")
public class InstallApkPlugin extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String uri = call.getString("uri", "");
        if (uri == null || uri.isEmpty()) {
            call.reject("Parameter uri wajib diisi");
            return;
        }
        try {
            if (uri.startsWith("file://")) {
                uri = uri.substring(7);
            }
            File apk = new File(uri);
            if (!apk.exists()) {
                call.reject("File APK tidak ditemukan: " + uri);
                return;
            }
            Context ctx = getContext();
            Uri apkUri = FileProvider.getUriForFile(
                ctx,
                ctx.getPackageName() + ".fileprovider",
                apk
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            ctx.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal membuka pemasang: " + e.getMessage());
        }
    }
}
