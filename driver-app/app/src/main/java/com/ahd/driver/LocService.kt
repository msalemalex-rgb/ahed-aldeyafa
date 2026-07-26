package com.ahd.driver

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Looper
import com.google.android.gms.location.*
import java.net.HttpURLConnection
import java.net.URL

class LocService : Service() {

    companion object {
        @Volatile var running = false
        @Volatile var status = "جاهز"
        @Volatile var orderId = ""
        const val CH = "loc_channel"
        const val NID = 11
    }

    private var fused: FusedLocationProviderClient? = null
    private var cb: LocationCallback? = null
    private var sent = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val order = intent?.getStringExtra("order") ?: orderId
        if (order.isBlank()) { stopSelf(); return START_NOT_STICKY }
        orderId = order
        running = true
        sent = 0
        status = "📡 بدء المشاركة..."

        createChannel()
        val notif = buildNotif("جاري مشاركة موقعك مع الزبون")
        if (Build.VERSION.SDK_INT >= 29)
            startForeground(NID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        else
            startForeground(NID, notif)

        fused = LocationServices.getFusedLocationProviderClient(this)
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 12000L)
            .setMinUpdateIntervalMillis(8000L)
            .build()
        cb = object : LocationCallback() {
            override fun onLocationResult(r: LocationResult) {
                val l = r.lastLocation ?: return
                push(l.latitude, l.longitude)
            }
        }
        try {
            fused?.requestLocationUpdates(req, cb!!, Looper.getMainLooper())
        } catch (se: SecurityException) {
            status = "⚠️ إذن الموقع مرفوض"
            stopSelf()
        }
        return START_STICKY
    }

    private fun push(lat: Double, lng: Double) {
        Thread {
            try {
                val c = URL("https://ahed-aldeyafa.vercel.app/api/orders").openConnection() as HttpURLConnection
                c.requestMethod = "POST"
                c.doOutput = true
                c.connectTimeout = 10000
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write("{\"locFor\":\"$orderId\",\"lat\":$lat,\"lng\":$lng}".toByteArray()) }
                val code = c.responseCode
                c.disconnect()
                if (code in 200..299) {
                    sent++
                    status = "📡 شغال — اتبعت $sent إشارة"
                    notify("جاري مشاركة موقعك ($sent إشارة)")
                } else if (code == 409) {
                    status = "⛔ الطلب اتقفل — توقفت المشاركة"
                    stopSelf()
                } else {
                    status = "⚠️ مشكلة اتصال — بنحاول تاني"
                }
            } catch (e: Exception) {
                status = "⚠️ مشكلة شبكة — بنحاول تاني"
            }
        }.start()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(CH, "مشاركة الموقع", NotificationManager.IMPORTANCE_LOW)
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
    }

    private fun buildNotif(text: String): Notification {
        val pi = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH) else Notification.Builder(this)
        return b.setContentTitle("سائق عهد الضيافة 🚗")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setContentIntent(pi)
            .build()
    }

    private fun notify(text: String) {
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NID, buildNotif(text))
    }

    override fun onDestroy() {
        cb?.let { fused?.removeLocationUpdates(it) }
        running = false
        status = "⏸️ متوقف"
        super.onDestroy()
    }
}
