import sys
import subprocess

def main():
    try:
        import flask
        from app import app
        print("\n" + "="*60)
        print(" Launching RaceGuard Web Server")
        print(" Access Dashboard at: http://127.0.0.1:5000")
        print("="*60 + "\n")
        app.run(debug=True, host="127.0.0.1", port=5000)
    except ImportError:
        print("Flask is not installed in current Python interpreter:", sys.executable)
        print("Checking if Flask is available via Windows 'py' launcher...")
        
        # Check if 'py' launcher has flask installed
        chk = subprocess.run(["py", "-c", "import flask; print('OK')"], capture_output=True, text=True)
        if "OK" in chk.stdout:
            print("Found Flask in Windows Python! Switching execution to 'py app.py'...\n")
            subprocess.run(["py", "app.py"])
            return
        
        print("Installing Flask using 'py'...")
        subprocess.run(["py", "-m", "pip", "install", "flask"])
        subprocess.run(["py", "app.py"])

if __name__ == "__main__":
    main()
