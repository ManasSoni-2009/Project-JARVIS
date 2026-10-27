@echo off
echo Starting J.A.R.V.I.S Installation for Windows...

echo Cloning the repository...
git clone https://github.com/YOUR_USERNAME/project-jarvis.git
cd project-jarvis

echo Installing uv...
pip install uv

echo Syncing dependencies...
uv sync

echo Installing Playwright browsers...
uv run playwright install chromium

echo Installing OpenClaw...
npm install -g openclaw@latest

echo Installing FFmpeg...
winget install Gyan.FFmpeg

echo Copying .env.example to .env...
copy .env.example .env

echo Installation complete! Please edit your .env file with your API keys, then run:
echo uv run jarvis
pause
