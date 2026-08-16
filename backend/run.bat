@echo off
echo Setting up dependencies...
py -m ensurepip --default-pip 2>nul
py -m pip install flask 2>nul
if %errorlevel% neq 0 (
    python -m ensurepip --default-pip 2>nul
    python -m pip install flask
)
echo Starting RaceGuard...
py run.py 2>nul
if %errorlevel% neq 0 (
    python run.py
)
pause
