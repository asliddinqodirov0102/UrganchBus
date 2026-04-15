# 🚌 Urganch Bus — Jamoat Transporti Tizimi

Urganch shahri uchun real-vaqt avtobus yo'nalishlari, bekatlar va jadvallar boshqaruv tizimi.

## 🌐 Demo

> **Backend (Render):** https://urganch-bus-backend.onrender.com  
> **Asosiy sahifa:** https://urganch-bus-backend.onrender.com  
> **Admin panel:** https://urganch-bus-backend.onrender.com/admin/admin.html

---

## 🛠 Texnologiyalar

| Qism | Texnologiya |
|------|-------------|
| Backend | Python + Flask |
| Database | SQLite |
| Frontend | HTML + CSS + JavaScript (Vanilla) |
| Xarita | Leaflet.js |
| Hosting | Render.com (bepul) |

---

## 🚀 Lokal ishga tushirish

### Talablar
- Python 3.10+
- pip

### Qadamlar

```bash
# 1. Loyihani yuklab oling
git clone https://github.com/SIZNING_USERNAME/urganch-bus.git
cd urganch-bus

# 2. Virtual muhit yarating (ixtiyoriy)
python -m venv venv
venv\Scripts\activate   # Windows

# 3. Kutubxonalarni o'rnating
pip install -r backend/requirements.txt

# 4. Serverni ishga tushiring
python backend/app.py
```

Brauzerda oching: http://127.0.0.1:5000

---

## 📁 Loyiha tuzilmasi

```
urganch-bus/
├── backend/
│   ├── app.py          ← Flask server (asosiy fayl)
│   ├── admin_api.py    ← Admin CRUD API
│   ├── auth.py         ← Login/session
│   ├── models.py       ← SQLite jadvallar
│   ├── seed_data.py    ← Boshlang'ich ma'lumotlar
│   ├── requirements.txt
│   └── Procfile        ← Render uchun start buyrug'i
├── frontend/
│   ├── index.html      ← Asosiy sahifa
│   ├── css/style.css
│   ├── js/app.js       ← Asosiy logika
│   ├── js/map.js       ← Leaflet xarita
│   ├── js/timer.js     ← Countdown timer
│   └── admin/          ← Admin panel
│       ├── admin.html
│       ├── admin.js
│       └── admin.css
├── render.yaml         ← Render deploy konfiguratsiyasi
└── README.md
```

---

## 🔐 Admin Panel

- **URL:** `/admin/admin.html`
- **Login:** `admin`
- **Parol:** `urganch2025`

> ⚠️ Production'da parolni Render Environment Variables orqali o'zgartiring!

---

## 📡 API Endpointlar

| Method | Endpoint | Tavsif |
|--------|----------|--------|
| GET | `/api/routes` | Barcha faol yo'nalishlar |
| GET | `/api/schedule` | Jadval (route_id filter bilan) |
| GET | `/api/buses` | Barcha avtobuslar |
| GET | `/api/stops` | Bekatlar |
| GET | `/api/realtime` | Real-vaqt avtobus holati |
| POST | `/api/admin/login` | Admin login |
| GET/POST/PUT/DELETE | `/api/admin/routes` | Yo'nalishlar CRUD |
| GET/POST/PUT/DELETE | `/api/admin/stops` | Bekatlar CRUD |
| GET/POST/PUT/DELETE | `/api/admin/buses` | Avtobuslar CRUD |
| GET/POST/PUT/DELETE | `/api/admin/schedules` | Jadvallar CRUD |

---

## ☁️ Render.com ga Deploy Qilish

1. [GitHub](https://github.com) da yangi repo yarating
2. Loyihani push qiling: `git push origin main`
3. [Render.com](https://render.com) ga kiring → **New Web Service**
4. GitHub repo ni ulang
5. Sozlamalar:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
6. **Deploy** tugmasini bosing

Batafsil: [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) faylini ko'ring.
