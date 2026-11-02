@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 18 或更高版本，然后再次打开此文件。
  pause
  exit /b 1
)
echo 柳湾秘境正在启动，请打开 http://127.0.0.1:4173
echo 关闭此窗口即可停止本地服务。
node serve.mjs
pause
