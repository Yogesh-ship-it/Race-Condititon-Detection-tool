@echo off
echo ========================================================
echo  RaceGuard - Git Setup & Repository Push
echo ========================================================

echo Initializing Git repository...
git init
git branch -M main

echo Staging all files...
git add .

echo Creating initial commit...
git commit -m "Initial commit: Restructure RaceGuard into frontend and backend modules"

echo Adding remote origin...
git remote add origin https://github.com/Yogesh-ship-it/Race-Condititon-Detection-tool.git

echo Pushing main branch to GitHub...
git push -u origin main

echo ========================================================
echo Push complete! Check your repository at:
echo https://github.com/Yogesh-ship-it/Race-Condititon-Detection-tool
echo ========================================================
pause
