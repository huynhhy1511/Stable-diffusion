@echo off
:: Cấu hình màu sắc giao diện (0B: chữ màu xanh ngọc nhạt trên nền đen rất hiện đại)
color 0B
title AI Creative Studio Launcher
echo ====================================================================
echo             KHOI DONG PROFESSIONAL AI CREATIVE STUDIO
echo ====================================================================
echo.

:: Lấy đường dẫn thư mục hiện tại của file bat này
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: 1. Khởi động Backend trong cửa sổ thu nhỏ (minimized) để không làm vướng mắt bạn
echo [1/3] Dang khoi dong Backend (FastAPI + Uvicorn)...
start "AI Studio Backend" /min cmd /c "cd /d "%PROJECT_DIR%backend" && .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [*] Dang khoi dong Celery Worker (AI Processor)...
start "AI Studio Worker" /min cmd /c "cd /d "%PROJECT_DIR%backend" && .\venv\Scripts\python.exe -m celery -A app.celery_app worker --loglevel=info -P solo"

:: Chờ 3 giây để Backend khởi động xong
timeout /t 3 /nobreak >nul

:: 2. Khởi động Frontend trong cửa sổ thu nhỏ
echo [2/3] Dang khoi dong Frontend (React + Vite)...
start "AI Studio Frontend" /min cmd /c "cd /d "%PROJECT_DIR%frontend" && npm run dev"

:: Chờ 2 giây để Frontend sẵn sàng nhận kết nối
timeout /t 2 /nobreak >nul

:: 3. Tự động mở trình duyệt web hiển thị dự án
echo [3/3] Dang tu dong mo trinh duyet tai http://localhost:5173...
start http://localhost:5173

echo.
echo ====================================================================
echo  Da khoi dong du an thanh cong!
echo  - Backend dang chay ngam tai: http://127.0.0.1:8000
echo  - Frontend dang chay ngam tai: http://localhost:5173
echo.
echo  * Luu y: De tat server khi khong dung nua, ban chi can dong cac cua
echo    so terminal thu nho hoac tat cua so bat nay la xong.
echo ====================================================================
echo.
echo Bam phim bat ky de thoat cua so khoi dong nay...
pause >nul
