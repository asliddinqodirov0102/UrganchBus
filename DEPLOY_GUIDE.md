# 🚀 Urganch Bus — Deploy Qo'llanmasi (Render.com)

Ushbu qo'llanmada Urganch Bus dasturini bepul **Render.com** serveriga joylashtirish ko'rsatilgan.

---

## 📋 Kerakli narsalar

- GitHub akkaunt (bepul): https://github.com
- Render akkaunt (bepul): https://render.com
- Git o'rnatilgan bo'lishi kerak

---

## 1-qadam: Git o'rnatish (agar yo'q bo'lsa)

https://git-scm.com/download/win saytidan yuklab o'rnating.

O'rnatilganini tekshiring:
```
git --version
```

---

## 2-qadam: GitHub da yangi repository yaratish

1. https://github.com ga kiring
2. Yuqori o'ng burchakda **"+"** → **"New repository"**
3. **Repository name:** `urganch-bus`
4. **Public** ni tanlang (bepul hosting uchun)
5. **Create repository** tugmasini bosing

---

## 3-qadam: Loyihani GitHubga yuklash

PowerShell yoki CMD terminalni oching va quyidagi buyruqlarni ketma-ket bajaring:

```powershell
# Loyiha papkasiga o'ting
cd C:\Users\Asliddin_Qodirov\.gemini\antigravity\scratch\urganch-bus

# Git boshlash
git init

# Barcha fayllarni qo'shish
git add .

# Birinchi commit
git commit -m "🚌 Urganch Bus - Initial commit"

# GitHub repo ga ulash (USERNAME o'rniga o'zingiznikini yozing)
git remote add origin https://github.com/USERNAME/urganch-bus.git

# GitHubga yuborish
git push -u origin main
```

> ⚠️ GitHub login so'rasa, username va parolingizni kiriting yoki Personal Access Token ishlating.

---

## 4-qadam: Render.com da Web Service yaratish

1. https://render.com ga kiring → **"Get Started for Free"**
2. **GitHub** bilan ro'yxatdan o'ting
3. Dashboard da **"New +"** → **"Web Service"**

![Render New Service](https://render.com/static/...)

4. **"Connect a repository"** → `urganch-bus` ni tanlang
5. Quyidagi sozlamalarni kiriting:

| Maydon | Qiymat |
|--------|--------|
| **Name** | `urganch-bus-backend` |
| **Region** | Frankfurt (EU Central) — eng yaqin |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn app:app` |
| **Instance Type** | `Free` |

---

## 5-qadam: Environment Variables o'rnatish

"Environment" bo'limida quyidagilarni qo'shing:

| Key | Value |
|-----|-------|
| `FLASK_ENV` | `production` |
| `SECRET_KEY` | `urganch-bus-xorazm-2025-kalit` (o'zgartiring!) |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `sizning_parolingiz` (o'zgartiring!) |

---

## 6-qadam: Deploy!

**"Create Web Service"** tugmasini bosing.

Deploy 3-5 daqiqa davom etadi. Render log oynasida quyidagilarni ko'rasiz:

```
==> Building...
==> pip install -r requirements.txt
==> Starting service with 'gunicorn app:app'
[DB] Jadvallar muvaffaqiyatli yaratildi.
[Seed] Ma'lumotlar yuklandi.
[2026-04-15 10:00:00] [INFO] Starting gunicorn 22.0.0
[2026-04-15 10:00:00] [INFO] Listening at: http://0.0.0.0:10000
```

---

## 7-qadam: URL ni olish va sinab ko'rish

Deploy tugagach, Render sizga URL beradi:
```
https://urganch-bus-backend.onrender.com
```

Tekshiring:
- ✅ Asosiy sahifa: `https://urganch-bus-backend.onrender.com`
- ✅ API test: `https://urganch-bus-backend.onrender.com/api/routes`
- ✅ Admin panel: `https://urganch-bus-backend.onrender.com/admin/admin.html`

---

## 8-qadam: UptimeRobot — server doim uyg'oq turishi uchun (IXTIYORIY)

Render bepul rejimda 15 daqiqa faoliyatsiz bo'lsa server "uxlaydi". Buning oldini olish:

1. https://uptimerobot.com ga bepul ro'yxatdan o'ting
2. **"Add New Monitor"** tugmasini bosing
3. Sozlamalar:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Urganch Bus
   - **URL:** `https://urganch-bus-backend.onrender.com/api/routes`
   - **Monitoring Interval:** 5 minutes
4. **"Create Monitor"** → Tayyor!

Endi server doim uyg'oq turadi ✅

---

## ⚠️ Muhim eslatmalar

> **SQLite va ma'lumotlar:** Render bepul rejimda disk storage yo'q. Har server qayta ishga tushganda `seed_data.py` ma'lumotlarni qayta yuklaydi. Admin orqali kiritgan yangi yo'nalishlar server qayta ishga tushganda o'chib ketadi. **Yechim:** PostgreSQL ga o'tish (Render da 1 ta bepul PostgreSQL bor).

> **HTTPS:** Render avtomatik SSL sertifikat beradi — https:// ishlaydi.

> **Custom domen:** Render da o'z domeningizni ulashingiz mumkin (masalan: bus.urganch.uz)

---

## 🔄 Kodni yangilash

Har safar kodni o'zgartirganingizda:

```powershell
git add .
git commit -m "Yangilanish"
git push
```

Render avtomatik qayta deploy qiladi! ✨

---

## 📞 Yordam

Muammo bo'lsa:
- Render logs: Dashboard → Service → "Logs" tab
- API test: brauzerda `/api/routes` oching
