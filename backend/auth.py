"""
auth.py — Urganch Bus Admin autentifikatsiya moduli
Session asosida oddiy login/logout tizimi
"""

import os
from functools import wraps
from flask import session, jsonify

# ─── Admin hisob ma'lumotlari ─────────────────────────────────────────────────
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "urganch2025")

# Flask session uchun maxfiy kalit (Render'da env variable sifatida o'rnatiladi)
SECRET_KEY = os.environ.get("SECRET_KEY", "urganch-bus-secret-2025-xorazm")



def check_credentials(username: str, password: str) -> bool:
    """Foydalanuvchi nomi va parolni tekshirish"""
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD


def login_required(f):
    """
    Dekorator — admin API endpointlarini himoyalash.
    Session'da 'admin_logged_in' = True bo'lmasa 401 qaytaradi.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return jsonify({"error": "Avtorizatsiya talab etiladi", "auth": False}), 401
        return f(*args, **kwargs)
    return decorated
