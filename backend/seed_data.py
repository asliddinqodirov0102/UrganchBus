"""
seed_data.py — Urganch Bus uchun boshlang'ich ma'lumotlar
3 ta haqiqiy Urganch yo'nalish, bekatlar, avtobuslar va jadvallar
"""

from models import get_db_connection, init_db


# ─────────────────────────────────────────────
#  Haqiqiy Urganch koordinatalari (taxminiy)
#  Markaz: 41.5480° N, 60.6330° E
# ─────────────────────────────────────────────

ROUTES = [
    {
        "number": "1",
        "name": "Vokzal — Aeroport",
        "color": "#3B82F6",  # moviy
        "description": "Temir yo'l vokzalidan aeroportgacha asosiy yo'nalish",
    },
    {
        "number": "2",
        "name": "Yangi Urgench — Xorazm Universiteti",
        "color": "#10B981",  # yashil
        "description": "Yangi Urgench tumanidan universitetgacha",
    },
    {
        "number": "3",
        "name": "Do'stlik — Karvon Bozor",
        "color": "#F59E0B",  # sariq
        "description": "Do'stlik ko'chasidan Karvon bozorigacha",
    },
]

# Har yo'nalish uchun bekatlar [nomi, kenglik, uzunlik]
STOPS = {
    "1": [
        ("Temir yo'l Vokzali",    41.5385, 60.6208),
        ("Markaziy Maydon",       41.5440, 60.6270),
        ("Al-Xorazmiy Ko'chasi",  41.5469, 60.6315),
        ("Markaziy Shifoxona",    41.5498, 60.6350),
        ("Bozor turar-joy",       41.5530, 60.6400),
        ("Aeroport",              41.5605, 60.6512),
    ],
    "2": [
        ("Yangi Urgench (boshlang'ich)", 41.5320, 60.6150),
        ("Mustaqillik Xiyoboni",         41.5365, 60.6200),
        ("Shifokorlar tumani",           41.5410, 60.6255),
        ("Pedagogika Instituti",         41.5450, 60.6300),
        ("Stadium",                      41.5495, 60.6350),
        ("Xorazm Davlat Universiteti",   41.5548, 60.6412),
    ],
    "3": [
        ("Do'stlik Ko'chasi",    41.5450, 60.6180),
        ("Xalqlar Do'stligi",    41.5470, 60.6230),
        ("Eski Shahar",          41.5488, 60.6278),
        ("Savdo Markazi",        41.5500, 60.6320),
        ("Navoi Ko'chasi",       41.5515, 60.6370),
        ("Karvon Bozor",         41.5530, 60.6420),
        ("Sharq Mahallasi",      41.5555, 60.6470),
    ],
}

# Avtobus/karta
BUSES = {
    "1": [("01 A 123 BC", 45), ("01 A 456 BC", 45)],
    "2": [("01 B 789 BC", 35), ("01 B 321 BC", 35)],
    "3": [("01 C 654 BC", 30)],
}

# Jadval: (avtobus indeksi, bekat indeksi, vaqt)
SCHEDULES = {
    "1": [
        # Bus 0
        (0, 0, "07:00"), (0, 1, "07:10"), (0, 2, "07:18"),
        (0, 3, "07:25"), (0, 4, "07:33"), (0, 5, "07:45"),
        (0, 0, "09:00"), (0, 1, "09:10"), (0, 2, "09:18"),
        (0, 3, "09:25"), (0, 4, "09:33"), (0, 5, "09:45"),
        # Bus 1
        (1, 0, "08:00"), (1, 1, "08:10"), (1, 2, "08:18"),
        (1, 3, "08:25"), (1, 4, "08:33"), (1, 5, "08:45"),
        (1, 0, "10:00"), (1, 1, "10:10"), (1, 2, "10:18"),
        (1, 3, "10:25"), (1, 4, "10:33"), (1, 5, "10:45"),
    ],
    "2": [
        (0, 0, "07:15"), (0, 1, "07:22"), (0, 2, "07:30"),
        (0, 3, "07:38"), (0, 4, "07:46"), (0, 5, "07:55"),
        (1, 0, "08:15"), (1, 1, "08:22"), (1, 2, "08:30"),
        (1, 3, "08:38"), (1, 4, "08:46"), (1, 5, "08:55"),
    ],
    "3": [
        (0, 0, "07:30"), (0, 1, "07:37"), (0, 2, "07:44"),
        (0, 3, "07:50"), (0, 4, "07:57"), (0, 5, "08:05"),
        (0, 6, "08:12"),
        (0, 0, "09:30"), (0, 1, "09:37"), (0, 2, "09:44"),
        (0, 3, "09:50"), (0, 4, "09:57"), (0, 5, "10:05"),
        (0, 6, "10:12"),
    ],
}


def seed():
    """Bazani boshlang'ich ma'lumotlar bilan to'ldurish"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Agar ma'lumotlar allaqachon mavjud bo'lsa — o'tkazib yuborish
    existing = cursor.execute("SELECT COUNT(*) FROM routes").fetchone()[0]
    if existing > 0:
        print("[Seed] Ma'lumotlar allaqachon mavjud. O'tkazildi.")
        conn.close()
        return

    route_id_map = {}   # number -> db id
    bus_id_map = {}     # (number, bus_idx) -> db id
    stop_id_map = {}    # (number, stop_idx) -> db id

    # ─── Yo'nalishlarni kiritish ───────────────────────────────────────────
    for route in ROUTES:
        cursor.execute(
            "INSERT INTO routes (number, name, color, description) VALUES (?, ?, ?, ?)",
            (route["number"], route["name"], route["color"], route["description"]),
        )
        route_id_map[route["number"]] = cursor.lastrowid

    # ─── Bekatlarni kiritish ───────────────────────────────────────────────
    for route_num, stops in STOPS.items():
        rid = route_id_map[route_num]
        for i, (name, lat, lng) in enumerate(stops):
            cursor.execute(
                "INSERT INTO stops (route_id, name, lat, lng, order_num) VALUES (?, ?, ?, ?, ?)",
                (rid, name, lat, lng, i),
            )
            stop_id_map[(route_num, i)] = cursor.lastrowid

    # ─── Avtobuslarni kiritish ─────────────────────────────────────────────
    for route_num, buses in BUSES.items():
        rid = route_id_map[route_num]
        for i, (plate, capacity) in enumerate(buses):
            cursor.execute(
                "INSERT INTO buses (route_id, plate_number, capacity) VALUES (?, ?, ?)",
                (rid, plate, capacity),
            )
            bus_id_map[(route_num, i)] = cursor.lastrowid

    # ─── Jadvallarni kiritish ──────────────────────────────────────────────
    for route_num, entries in SCHEDULES.items():
        rid = route_id_map[route_num]
        for bus_idx, stop_idx, depart_time in entries:
            bid = bus_id_map[(route_num, bus_idx)]
            sid = stop_id_map[(route_num, stop_idx)]
            cursor.execute(
                "INSERT INTO schedules (route_id, bus_id, stop_id, depart_time) VALUES (?, ?, ?, ?)",
                (rid, bid, sid, depart_time),
            )

    conn.commit()
    conn.close()
    print("[Seed] Barcha ma'lumotlar muvaffaqiyatli kiritildi!")


if __name__ == "__main__":
    init_db()
    seed()
