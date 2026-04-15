"""
app.py — Urganch Bus Flask Backend
API endpointlar: /api/routes, /api/schedule, /api/buses, /api/stops
Frontend: http://127.0.0.1:5000  (statik fayllar Flask orqali)
"""

import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from models import get_db_connection, init_db
from seed_data import seed
from auth import SECRET_KEY
from admin_api import admin_bp

# Frontendning mutlaq yo'li
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

# ─── Flask ilovasini sozlash ──────────────────────────────────────────────────
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
app.secret_key = SECRET_KEY          # Session uchun maxfiy kalit
CORS(app, supports_credentials=True) # Admin cookie uchun credentials

# Admin blueprint ulash
app.register_blueprint(admin_bp)

# ─── Gunicorn uchun: module yuklanishida DB ni boshlash ──────────────────────
init_db()
seed()


# ═══════════════════════════════════════════════════════════════════════════════
#  Asosiy sahifa — Frontend index.html ni qaytarish
# ═══════════════════════════════════════════════════════════════════════════════
@app.route('/')
def serve_index():
    """Frontend index.html ni qaytarish"""
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """CSS, JS va boshqa statik fayllarni qaytarish"""
    full = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(FRONTEND_DIR, path)
    # Fallback — index.html (SPA uchun)
    return send_from_directory(FRONTEND_DIR, 'index.html')


# ═══════════════════════════════════════════════════════════════════════════════
#  GET /api/routes  —  Barcha faol yo'nalishlar (bekatlar bilan)
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/api/routes", methods=["GET"])
def get_routes():
    """
    Barcha yo'nalishlarni bekatlar bilan qaytaradi.
    Response: [ { id, number, name, color, description, stops: [...] } ]
    """
    conn = get_db_connection()

    # Faqat faol yo'nalishlar
    routes_rows = conn.execute(
        "SELECT * FROM routes WHERE is_active = 1 ORDER BY CAST(number AS INTEGER)"
    ).fetchall()

    result = []
    for route in routes_rows:
        rid = route["id"]

        # Ushbu yo'nalishning barcha bekatlarini tartib bilan olish
        stops_rows = conn.execute(
            """SELECT id, name, lat, lng, order_num
               FROM stops
               WHERE route_id = ?
               ORDER BY order_num""",
            (rid,),
        ).fetchall()

        stops = [
            {
                "id": s["id"],
                "name": s["name"],
                "lat": s["lat"],
                "lng": s["lng"],
                "order": s["order_num"],
            }
            for s in stops_rows
        ]

        result.append(
            {
                "id": rid,
                "number": route["number"],
                "name": route["name"],
                "color": route["color"],
                "description": route["description"],
                "stops": stops,
            }
        )

    conn.close()
    return jsonify(result)


# ═══════════════════════════════════════════════════════════════════════════════
#  GET /api/schedule?route_id=<id>  —  Yo'nalish jadvali
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/api/schedule", methods=["GET"])
def get_schedule():
    """
    Berilgan route_id uchun jadval qaytaradi.
    Query param: route_id (ixtiyoriy — bo'lmasa barcha jadvallar)
    Response: [ { bus_plate, stop_name, depart_time } ]
    """
    route_id = request.args.get("route_id", type=int)
    conn = get_db_connection()

    query = """
        SELECT
            b.plate_number  AS bus_plate,
            s.name          AS stop_name,
            s.order_num     AS stop_order,
            sc.depart_time  AS depart_time,
            r.number        AS route_number,
            r.name          AS route_name,
            r.color         AS route_color
        FROM schedules sc
        JOIN buses  b ON sc.bus_id   = b.id
        JOIN stops  s ON sc.stop_id  = s.id
        JOIN routes r ON sc.route_id = r.id
    """
    params = ()
    if route_id:
        query += " WHERE sc.route_id = ?"
        params = (route_id,)

    query += " ORDER BY r.number, b.plate_number, sc.depart_time"

    rows = conn.execute(query, params).fetchall()
    conn.close()

    result = [dict(row) for row in rows]
    return jsonify(result)


# ═══════════════════════════════════════════════════════════════════════════════
#  GET /api/buses  —  Barcha avtobuslar (yo'nalish bilan)
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/api/buses", methods=["GET"])
def get_buses():
    """
    Barcha avtobuslar va ular biriktirilgan yo'nalishlarni qaytaradi.
    Response: [ { id, plate_number, capacity, route_number, route_name } ]
    """
    conn = get_db_connection()
    rows = conn.execute(
        """SELECT b.id, b.plate_number, b.capacity, b.current_stop,
                  r.number AS route_number, r.name AS route_name, r.color AS route_color
           FROM buses b
           JOIN routes r ON b.route_id = r.id
           ORDER BY CAST(r.number AS INTEGER)"""
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ═══════════════════════════════════════════════════════════════════════════════
#  GET /api/stops?route_id=<id>  —  Yo'nalish bekatlarini alohida olish
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/api/stops", methods=["GET"])
def get_stops():
    """Berilgan route_id bo'yicha bekatlar ro'yxati"""
    route_id = request.args.get("route_id", type=int)
    conn = get_db_connection()

    if route_id:
        rows = conn.execute(
            "SELECT * FROM stops WHERE route_id = ? ORDER BY order_num", (route_id,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM stops ORDER BY route_id, order_num").fetchall()

    conn.close()
    return jsonify([dict(r) for r in rows])


# ═══════════════════════════════════════════════════════════════════════════════
#  GET /api/realtime  —  Real-vaqt simulyatsiya ma'lumotlari
# ═══════════════════════════════════════════════════════════════════════════════
@app.route("/api/realtime", methods=["GET"])
def get_realtime():
    """
    Har bir avtobus uchun simulyatsiya ma'lumotlari qaytaradi:
    - hozirgi va keyingi bekat
    - taxminiy kelish vaqti (daqiqalarda)
    Frontend JavaScript countdown timer uchun ishlatiladi.
    """
    import random
    conn = get_db_connection()

    buses = conn.execute(
        """SELECT b.id, b.plate_number, b.capacity, b.current_stop,
                  r.id AS route_id, r.number AS route_number,
                  r.name AS route_name, r.color AS route_color
           FROM buses b JOIN routes r ON b.route_id = r.id"""
    ).fetchall()

    result = []
    for bus in buses:
        # Yo'nalishning barcha bekatlarini olish
        stops = conn.execute(
            "SELECT * FROM stops WHERE route_id = ? ORDER BY order_num",
            (bus["route_id"],),
        ).fetchall()

        if not stops:
            continue

        total_stops = len(stops)
        # Tasodifiy pozitsiya (simulyatsiya)
        current_idx = random.randint(0, total_stops - 2)
        next_idx = (current_idx + 1) % total_stops
        eta_minutes = random.randint(2, 12)  # 2-12 daqiqa

        result.append(
            {
                "bus_id": bus["id"],
                "plate_number": bus["plate_number"],
                "route_number": bus["route_number"],
                "route_name": bus["route_name"],
                "route_color": bus["route_color"],
                "current_stop": dict(stops[current_idx]),
                "next_stop": dict(stops[next_idx]),
                "eta_minutes": eta_minutes,
                # interpolyatsiya uchun 0.0-1.0 orasida pozitsiya
                "progress": round(current_idx / max(total_stops - 1, 1), 3),
            }
        )

    conn.close()
    return jsonify(result)


# ─── Ishga tushirish ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV", "production") != "production"
    print("=" * 50)
    print("  Urganch Bus Backend ishga tushmoqda ...")
    print(f"  http://0.0.0.0:{port}")
    print("=" * 50)
    init_db()
    seed()
    app.run(debug=debug, host="0.0.0.0", port=port)
