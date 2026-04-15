"""
models.py — Urganch Bus ma'lumotlar bazasi modellari
SQLite jadvallar: routes (yo'nalishlar), stops (bekatlar), buses (avtobuslar), schedules (jadvallar)
"""

import sqlite3
import os

# Ma'lumotlar bazasi fayl yo'li
DB_PATH = os.path.join(os.path.dirname(__file__), "urganch_bus.db")


def get_db_connection():
    """SQLite bilan ulanish o'rnatish"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # natijalarni dict sifatida qaytarish
    return conn


def init_db():
    """Barcha jadvallarni yaratish (agar mavjud bo'lmasa)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # ── Yo'nalishlar jadvali ──────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS routes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            number      TEXT    NOT NULL UNIQUE,   -- masalan: "1", "2", "3"
            name        TEXT    NOT NULL,           -- masalan: "Vokzal - Aeroport"
            color       TEXT    NOT NULL,           -- hex rang (xaritada polyline uchun)
            description TEXT,
            is_active   INTEGER DEFAULT 1           -- 1 = faol, 0 = to'xtatilgan
        )
    """)

    # ── Bekatlar jadvali ─────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stops (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            route_id  INTEGER NOT NULL,
            name      TEXT    NOT NULL,             -- bekat nomi
            lat       REAL    NOT NULL,             -- kenglik
            lng       REAL    NOT NULL,             -- uzunlik
            order_num INTEGER NOT NULL,             -- yo'nalishdagi tartib raqami
            FOREIGN KEY (route_id) REFERENCES routes (id)
        )
    """)

    # ── Avtobuslar jadvali ───────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS buses (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            route_id      INTEGER NOT NULL,
            plate_number  TEXT    NOT NULL,         -- davlat raqami
            capacity      INTEGER DEFAULT 45,
            current_stop  INTEGER DEFAULT 0,        -- hozirgi bekat indeksi
            FOREIGN KEY (route_id) REFERENCES routes (id)
        )
    """)

    # ── Jadvallar jadvali ────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schedules (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            route_id   INTEGER NOT NULL,
            bus_id     INTEGER NOT NULL,
            stop_id    INTEGER NOT NULL,
            depart_time TEXT  NOT NULL,             -- masalan: "08:00"
            FOREIGN KEY (route_id)  REFERENCES routes (id),
            FOREIGN KEY (bus_id)    REFERENCES buses (id),
            FOREIGN KEY (stop_id)   REFERENCES stops (id)
        )
    """)

    conn.commit()
    conn.close()
    print("[DB] Jadvallar muvaffaqiyatli yaratildi.")
