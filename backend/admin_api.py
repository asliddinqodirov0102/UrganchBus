"""
admin_api.py — Urganch Bus Admin CRUD API
Barcha POST / PUT / DELETE endpointlar shu yerda.
Himoya: @login_required dekorator bilan.
"""

from flask import Blueprint, jsonify, request, session
from models import get_db_connection
from auth import check_credentials, login_required

# Blueprint yaratish — app.py ga ulanamiz
admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# ═══════════════════════════════════════════════════════════════════════════════
#  AUTH endpointlar
# ═══════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/login", methods=["POST"])
def admin_login():
    """
    POST /api/admin/login
    Body: { "username": "admin", "password": "..." }
    Response: { "success": true } yoki 401
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if check_credentials(username, password):
        session["admin_logged_in"] = True
        session["admin_username"] = username
        return jsonify({"success": True, "message": "Xush kelibsiz, Admin!"})
    return jsonify({"success": False, "message": "Noto'g'ri login yoki parol"}), 401


@admin_bp.route("/logout", methods=["POST"])
def admin_logout():
    """POST /api/admin/logout — Session'ni tozalash"""
    session.clear()
    return jsonify({"success": True})


@admin_bp.route("/check", methods=["GET"])
def admin_check():
    """GET /api/admin/check — Sessiya faolligini tekshirish"""
    logged_in = session.get("admin_logged_in", False)
    return jsonify({"logged_in": logged_in})


# ═══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD STATISTIKA
# ═══════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/stats", methods=["GET"])
@login_required
def get_stats():
    """
    GET /api/admin/stats
    Dashboard uchun umumiy statistika
    """
    conn = get_db_connection()
    stats = {
        "total_routes":    conn.execute("SELECT COUNT(*) FROM routes").fetchone()[0],
        "active_routes":   conn.execute("SELECT COUNT(*) FROM routes WHERE is_active=1").fetchone()[0],
        "total_stops":     conn.execute("SELECT COUNT(*) FROM stops").fetchone()[0],
        "total_buses":     conn.execute("SELECT COUNT(*) FROM buses").fetchone()[0],
        "total_schedules": conn.execute("SELECT COUNT(*) FROM schedules").fetchone()[0],
    }
    conn.close()
    return jsonify(stats)


# ═══════════════════════════════════════════════════════════════════════════════
#  ROUTES CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/routes", methods=["GET"])
@login_required
def admin_get_routes():
    """Barcha yo'nalishlar (faol va nofaol, bekat soni bilan)"""
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT r.*, COUNT(s.id) AS stop_count
        FROM routes r
        LEFT JOIN stops s ON s.route_id = r.id
        GROUP BY r.id
        ORDER BY CAST(r.number AS INTEGER)
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@admin_bp.route("/routes", methods=["POST"])
@login_required
def admin_create_route():
    """
    POST /api/admin/routes
    Body: { number, name, color, description }
    """
    data = request.get_json(silent=True) or {}
    required = ["number", "name", "color"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Majburiy maydonlar: {', '.join(missing)}"}), 400

    conn = get_db_connection()
    # Raqam takrorlanishini tekshirish
    exists = conn.execute("SELECT id FROM routes WHERE number=?", (data["number"],)).fetchone()
    if exists:
        conn.close()
        return jsonify({"error": f"Yo'nalish #{data['number']} allaqachon mavjud"}), 409

    cursor = conn.execute(
        "INSERT INTO routes (number, name, color, description, is_active) VALUES (?,?,?,?,1)",
        (data["number"], data["name"], data["color"], data.get("description", ""))
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return jsonify({"success": True, "id": new_id}), 201


@admin_bp.route("/routes/<int:route_id>", methods=["PUT"])
@login_required
def admin_update_route(route_id):
    """
    PUT /api/admin/routes/<id>
    Body: { number?, name?, color?, description?, is_active? }
    """
    data = request.get_json(silent=True) or {}
    conn = get_db_connection()

    route = conn.execute("SELECT * FROM routes WHERE id=?", (route_id,)).fetchone()
    if not route:
        conn.close()
        return jsonify({"error": "Yo'nalish topilmadi"}), 404

    # Faqat berilgan maydonlarni yangilash
    number      = data.get("number",      route["number"])
    name        = data.get("name",        route["name"])
    color       = data.get("color",       route["color"])
    description = data.get("description", route["description"])
    is_active   = data.get("is_active",   route["is_active"])

    conn.execute(
        "UPDATE routes SET number=?, name=?, color=?, description=?, is_active=? WHERE id=?",
        (number, name, color, description, int(is_active), route_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@admin_bp.route("/routes/<int:route_id>", methods=["DELETE"])
@login_required
def admin_delete_route(route_id):
    """
    DELETE /api/admin/routes/<id>
    Bog'liq bekatlar, avtobuslar, jadvallar ham o'chiriladi (CASCADE)
    """
    conn = get_db_connection()
    route = conn.execute("SELECT id FROM routes WHERE id=?", (route_id,)).fetchone()
    if not route:
        conn.close()
        return jsonify({"error": "Yo'nalish topilmadi"}), 404

    # Bog'liq ma'lumotlarni ketma-ket o'chirish
    conn.execute("DELETE FROM schedules WHERE route_id=?", (route_id,))
    conn.execute("DELETE FROM buses     WHERE route_id=?", (route_id,))
    conn.execute("DELETE FROM stops     WHERE route_id=?", (route_id,))
    conn.execute("DELETE FROM routes    WHERE id=?",       (route_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@admin_bp.route("/routes/<int:route_id>/toggle", methods=["POST"])
@login_required
def admin_toggle_route(route_id):
    """POST /api/admin/routes/<id>/toggle — Faol/nofaol almashtirish"""
    conn = get_db_connection()
    route = conn.execute("SELECT is_active FROM routes WHERE id=?", (route_id,)).fetchone()
    if not route:
        conn.close()
        return jsonify({"error": "Topilmadi"}), 404
    new_status = 0 if route["is_active"] else 1
    conn.execute("UPDATE routes SET is_active=? WHERE id=?", (new_status, route_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "is_active": new_status})


# ═══════════════════════════════════════════════════════════════════════════════
#  STOPS CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/stops", methods=["GET"])
@login_required
def admin_get_stops():
    """Barcha bekatlar (yo'nalish nomi bilan)"""
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT s.*, r.name AS route_name, r.number AS route_number, r.color AS route_color
        FROM stops s JOIN routes r ON s.route_id = r.id
        ORDER BY CAST(r.number AS INTEGER), s.order_num
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@admin_bp.route("/stops", methods=["POST"])
@login_required
def admin_create_stop():
    """
    POST /api/admin/stops
    Body: { route_id, name, lat, lng, order_num }
    """
    data = request.get_json(silent=True) or {}
    required = ["route_id", "name", "lat", "lng"]
    missing = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": f"Majburiy maydonlar: {', '.join(missing)}"}), 400

    conn = get_db_connection()
    # Tartib raqamini avtomatik aniqlash
    max_order = conn.execute(
        "SELECT COALESCE(MAX(order_num), -1) FROM stops WHERE route_id=?",
        (data["route_id"],)
    ).fetchone()[0]
    order = data.get("order_num", max_order + 1)

    cursor = conn.execute(
        "INSERT INTO stops (route_id, name, lat, lng, order_num) VALUES (?,?,?,?,?)",
        (data["route_id"], data["name"], float(data["lat"]), float(data["lng"]), order)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return jsonify({"success": True, "id": new_id}), 201


@admin_bp.route("/stops/<int:stop_id>", methods=["PUT"])
@login_required
def admin_update_stop(stop_id):
    """PUT /api/admin/stops/<id>"""
    data = request.get_json(silent=True) or {}
    conn = get_db_connection()
    stop = conn.execute("SELECT * FROM stops WHERE id=?", (stop_id,)).fetchone()
    if not stop:
        conn.close()
        return jsonify({"error": "Bekat topilmadi"}), 404

    name      = data.get("name",      stop["name"])
    lat       = data.get("lat",       stop["lat"])
    lng       = data.get("lng",       stop["lng"])
    order_num = data.get("order_num", stop["order_num"])

    conn.execute(
        "UPDATE stops SET name=?, lat=?, lng=?, order_num=? WHERE id=?",
        (name, float(lat), float(lng), order_num, stop_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@admin_bp.route("/stops/<int:stop_id>", methods=["DELETE"])
@login_required
def admin_delete_stop(stop_id):
    """DELETE /api/admin/stops/<id>"""
    conn = get_db_connection()
    stop = conn.execute("SELECT id FROM stops WHERE id=?", (stop_id,)).fetchone()
    if not stop:
        conn.close()
        return jsonify({"error": "Topilmadi"}), 404
    conn.execute("DELETE FROM schedules WHERE stop_id=?", (stop_id,))
    conn.execute("DELETE FROM stops WHERE id=?", (stop_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ═══════════════════════════════════════════════════════════════════════════════
#  BUSES CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/buses", methods=["GET"])
@login_required
def admin_get_buses():
    """Barcha avtobuslar (yo'nalish bilan)"""
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT b.*, r.name AS route_name, r.number AS route_number, r.color AS route_color
        FROM buses b JOIN routes r ON b.route_id = r.id
        ORDER BY CAST(r.number AS INTEGER), b.plate_number
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@admin_bp.route("/buses", methods=["POST"])
@login_required
def admin_create_bus():
    """
    POST /api/admin/buses
    Body: { route_id, plate_number, capacity }
    """
    data = request.get_json(silent=True) or {}
    required = ["route_id", "plate_number"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Majburiy maydonlar: {', '.join(missing)}"}), 400

    conn = get_db_connection()
    exists = conn.execute(
        "SELECT id FROM buses WHERE plate_number=?", (data["plate_number"],)
    ).fetchone()
    if exists:
        conn.close()
        return jsonify({"error": "Bu davlat raqami allaqachon mavjud"}), 409

    cursor = conn.execute(
        "INSERT INTO buses (route_id, plate_number, capacity) VALUES (?,?,?)",
        (data["route_id"], data["plate_number"], data.get("capacity", 45))
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return jsonify({"success": True, "id": new_id}), 201


@admin_bp.route("/buses/<int:bus_id>", methods=["PUT"])
@login_required
def admin_update_bus(bus_id):
    """PUT /api/admin/buses/<id>"""
    data = request.get_json(silent=True) or {}
    conn = get_db_connection()
    bus = conn.execute("SELECT * FROM buses WHERE id=?", (bus_id,)).fetchone()
    if not bus:
        conn.close()
        return jsonify({"error": "Avtobus topilmadi"}), 404

    route_id     = data.get("route_id",     bus["route_id"])
    plate_number = data.get("plate_number", bus["plate_number"])
    capacity     = data.get("capacity",     bus["capacity"])

    conn.execute(
        "UPDATE buses SET route_id=?, plate_number=?, capacity=? WHERE id=?",
        (route_id, plate_number, capacity, bus_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@admin_bp.route("/buses/<int:bus_id>", methods=["DELETE"])
@login_required
def admin_delete_bus(bus_id):
    """DELETE /api/admin/buses/<id>"""
    conn = get_db_connection()
    bus = conn.execute("SELECT id FROM buses WHERE id=?", (bus_id,)).fetchone()
    if not bus:
        conn.close()
        return jsonify({"error": "Topilmadi"}), 404
    conn.execute("DELETE FROM schedules WHERE bus_id=?", (bus_id,))
    conn.execute("DELETE FROM buses WHERE id=?", (bus_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ═══════════════════════════════════════════════════════════════════════════════
#  SCHEDULES CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/schedules", methods=["GET"])
@login_required
def admin_get_schedules():
    """Barcha jadvallar"""
    conn = get_db_connection()
    route_id = request.args.get("route_id", type=int)
    query = """
        SELECT sc.id, sc.depart_time,
               b.plate_number, s.name AS stop_name, s.order_num,
               r.number AS route_number, r.name AS route_name, r.color AS route_color,
               sc.bus_id, sc.stop_id, sc.route_id
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
    return jsonify([dict(r) for r in rows])


@admin_bp.route("/schedules", methods=["POST"])
@login_required
def admin_create_schedule():
    """
    POST /api/admin/schedules
    Body: { route_id, bus_id, stop_id, depart_time }
    """
    data = request.get_json(silent=True) or {}
    required = ["route_id", "bus_id", "stop_id", "depart_time"]
    missing = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": f"Majburiy: {', '.join(missing)}"}), 400

    # Vaqt formatini tekshirish (HH:MM)
    import re
    if not re.match(r"^\d{2}:\d{2}$", str(data["depart_time"])):
        return jsonify({"error": "Vaqt formati: HH:MM (masalan: 07:30)"}), 400

    conn = get_db_connection()
    cursor = conn.execute(
        "INSERT INTO schedules (route_id, bus_id, stop_id, depart_time) VALUES (?,?,?,?)",
        (data["route_id"], data["bus_id"], data["stop_id"], data["depart_time"])
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return jsonify({"success": True, "id": new_id}), 201


@admin_bp.route("/schedules/<int:sc_id>", methods=["PUT"])
@login_required
def admin_update_schedule(sc_id):
    """PUT /api/admin/schedules/<id>"""
    data = request.get_json(silent=True) or {}
    conn = get_db_connection()
    sc = conn.execute("SELECT * FROM schedules WHERE id=?", (sc_id,)).fetchone()
    if not sc:
        conn.close()
        return jsonify({"error": "Jadval topilmadi"}), 404

    route_id   = data.get("route_id",   sc["route_id"])
    bus_id     = data.get("bus_id",     sc["bus_id"])
    stop_id    = data.get("stop_id",    sc["stop_id"])
    depart_time= data.get("depart_time",sc["depart_time"])

    conn.execute(
        "UPDATE schedules SET route_id=?, bus_id=?, stop_id=?, depart_time=? WHERE id=?",
        (route_id, bus_id, stop_id, depart_time, sc_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@admin_bp.route("/schedules/<int:sc_id>", methods=["DELETE"])
@login_required
def admin_delete_schedule(sc_id):
    """DELETE /api/admin/schedules/<id>"""
    conn = get_db_connection()
    sc = conn.execute("SELECT id FROM schedules WHERE id=?", (sc_id,)).fetchone()
    if not sc:
        conn.close()
        return jsonify({"error": "Topilmadi"}), 404
    conn.execute("DELETE FROM schedules WHERE id=?", (sc_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})
