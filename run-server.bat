@echo off
chcp 65001 >nul
title Urganch Bus — Backend Server

echo ================================================
echo   🚌 Urganch Bus — Flask Backend
echo   http://127.0.0.1:5000
echo ================================================
echo.

cd /d "%~dp0backend"
python app.py

pause
