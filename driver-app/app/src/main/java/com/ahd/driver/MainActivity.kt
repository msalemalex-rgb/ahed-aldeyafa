package com.ahd.driver

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.*
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {

    private lateinit var codeInput: EditText
    private lateinit var statusText: TextView
    private lateinit var startBtn: Button
    private lateinit var stopBtn: Button
    private lateinit var doneBtn: Button
    private val ui = Handler(Looper.getMainLooper())

    private val maroon = Color.parseColor("#6e1423")
    private val gold = Color.parseColor("#c8962f")
    private val green = Color.parseColor("#1faa54")
    private val blue = Color.parseColor("#2563c9")
    private val red = Color.parseColor("#c0392b")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#faf6ef"))
            setPadding(48, 80, 48, 48)
            gravity = Gravity.CENTER_HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }

        val title = TextView(this).apply {
            text = "🚗 سائق عهد الضيافة"
            textSize = 24f
            setTextColor(maroon)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        root.addView(title)

        val sub = TextView(this).apply {
            text = "شغّل المشاركة وحط الموبايل في جيبك —\nالموقع بيتبعت للزبون حتى والشاشة مقفولة"
            textSize = 14f
            setTextColor(Color.parseColor("#666666"))
            gravity = Gravity.CENTER
            setPadding(0, 16, 0, 40)
        }
        root.addView(sub)

        codeInput = EditText(this).apply {
            hint = "كود التوصيلة (من رسالة المطعم)"
            inputType = InputType.TYPE_CLASS_TEXT
            textSize = 15f
            gravity = Gravity.CENTER
            setBackgroundColor(Color.WHITE)
            setPadding(24, 32, 24, 32)
        }
        root.addView(codeInput, lp(0, 24))

        startBtn = mkBtn("▶️ ابدأ مشاركة الموقع", green) { startShare() }
        stopBtn = mkBtn("⏸️ إيقاف المشاركة", red) { stopShare() }
        doneBtn = mkBtn("✅ تم التسليم", blue) { markDone() }
        root.addView(startBtn, lp(0, 12))
        root.addView(stopBtn, lp(0, 12))
        root.addView(doneBtn, lp(0, 12))

        statusText = TextView(this).apply {
            textSize = 15f
            setTextColor(maroon)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 40, 0, 0)
        }
        root.addView(statusText)

        setContentView(ScrollView(this).apply { addView(root) })

        handleIntent(intent)
        refreshUi()
        ui.post(object : Runnable {
            override fun run() { refreshUi(); ui.postDelayed(this, 2000) }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(i: Intent?) {
        val o = i?.data?.getQueryParameter("o")
        if (!o.isNullOrBlank()) codeInput.setText(o.trim())
    }

    private fun mkBtn(label: String, color: Int, onClick: () -> Unit): Button =
        Button(this).apply {
            text = label
            textSize = 17f
            setTextColor(Color.WHITE)
            setBackgroundColor(color)
            setPadding(24, 36, 24, 36)
            setOnClickListener { onClick() }
        }

    private fun lp(w: Int, topMargin: Int): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { setMargins(0, topMargin, 0, 0) }

    private fun startShare() {
        val code = codeInput.text.toString().trim()
        if (code.isEmpty()) { toast("اكتب كود التوصيلة الأول"); return }

        val need = mutableListOf<String>()
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.ACCESS_FINE_LOCATION)
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.POST_NOTIFICATIONS)
        if (need.isNotEmpty()) { requestPermissions(need.toTypedArray(), 7); return }

        val svc = Intent(this, LocService::class.java).putExtra("order", code)
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(svc) else startService(svc)
        toast("بدأت المشاركة — تقدر تقفل الشاشة")
    }

    override fun onRequestPermissionsResult(rc: Int, p: Array<out String>, g: IntArray) {
        super.onRequestPermissionsResult(rc, p, g)
        if (rc == 7 && g.isNotEmpty() && g[0] == PackageManager.PERMISSION_GRANTED) startShare()
        else if (rc == 7) toast("لازم توافق على إذن الموقع عشان المشاركة تشتغل")
    }

    private fun stopShare() {
        stopService(Intent(this, LocService::class.java))
        toast("اتوقفت المشاركة")
    }

    private fun markDone() {
        val code = codeInput.text.toString().trim()
        if (code.isEmpty()) { toast("اكتب كود التوصيلة"); return }
        Thread {
            try {
                val c = URL("https://ahed-aldeyafa.vercel.app/api/orders").openConnection() as HttpURLConnection
                c.requestMethod = "POST"
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write("{\"deliveredBy\":\"$code\"}".toByteArray()) }
                val ok = c.responseCode in 200..299
                c.disconnect()
                ui.post {
                    if (ok) { toast("🎉 تم تسجيل التسليم"); stopShare() }
                    else toast("مشكلة اتصال — جرب تاني")
                }
            } catch (e: Exception) {
                ui.post { toast("مشكلة اتصال — جرب تاني") }
            }
        }.start()
    }

    private fun refreshUi() {
        val running = LocService.running
        startBtn.visibility = if (running) View.GONE else View.VISIBLE
        stopBtn.visibility = if (running) View.VISIBLE else View.GONE
        doneBtn.visibility = if (running) View.VISIBLE else View.GONE
        statusText.text = LocService.status
        if (running && codeInput.text.isBlank() && LocService.orderId.isNotBlank())
            codeInput.setText(LocService.orderId)
    }

    private fun toast(t: String) = Toast.makeText(this, t, Toast.LENGTH_LONG).show()
}
