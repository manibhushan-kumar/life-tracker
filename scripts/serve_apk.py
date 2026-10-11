#!/usr/bin/env python3
"""
Life Tracker - APK Local Download Server
Allows downloading the compiled APK over local Wi-Fi directly to an Android phone or browser.
"""

import os
import sys
import socket
import shutil
import time
import threading
import webbrowser
import argparse
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APK_NAME = "life-tracker.apk"
APK_PATH = os.path.join(PROJECT_DIR, APK_NAME)
FALLBACK_APK_SOURCE = os.path.join(PROJECT_DIR, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
LOGO_PATH = os.path.join(PROJECT_DIR, "life-tracker-logo.png")

def ensure_apk_exists():
    """Ensure life-tracker.apk exists in the project root."""
    if os.path.isfile(APK_PATH):
        return True
    # Check fallback in android build output
    if os.path.isfile(FALLBACK_APK_SOURCE):
        print(f"📦 Copying compiled APK from android build directory to root ({APK_NAME})...")
        try:
            shutil.copy2(FALLBACK_APK_SOURCE, APK_PATH)
            shutil.copy2(FALLBACK_APK_SOURCE, os.path.join(PROJECT_DIR, "app-debug.apk"))
            return True
        except Exception as e:
            print(f"⚠️ Error copying APK: {e}")
            return False
    return False

def get_local_ip():
    """Find the host's LAN IP address on Wi-Fi/Ethernet."""
    # Method 1: Connect dummy UDP socket (doesn't send data)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass

    # Method 2: hostname resolution
    try:
        hostname = socket.gethostname()
        ip = socket.gethostbyname(hostname)
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass

    return "localhost"

def format_size(bytes_size):
    """Format bytes into human readable string."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.1f} GB"

def find_available_port(start_port=8080, max_attempts=20):
    """Find an available port starting from start_port."""
    port = start_port
    for _ in range(max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("", port))
                return port
            except OSError:
                port += 1
    return start_port

def get_apk_meta():
    """Retrieve metadata about the compiled APK."""
    if not os.path.isfile(APK_PATH):
        return None
    stat = os.stat(APK_PATH)
    return {
        "name": APK_NAME,
        "size_bytes": stat.st_size,
        "size_str": format_size(stat.st_size),
        "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%b %d, %Y at %I:%M %p")
    }

def generate_html_page(meta, host_ip, port):
    """Generate responsive mobile-friendly download portal page."""
    base_url = f"http://{host_ip}:{port}"
    download_url = f"{base_url}/{APK_NAME}"

    if meta:
        file_status_html = f"""
        <div class="apk-info-box">
          <div class="apk-info-row">
            <span class="label">Package</span>
            <span class="value font-mono">life-tracker.apk</span>
          </div>
          <div class="apk-info-row">
            <span class="label">File Size</span>
            <span class="value badge-size">{meta['size_str']}</span>
          </div>
          <div class="apk-info-row">
            <span class="label">Built</span>
            <span class="value">{meta['modified']}</span>
          </div>
        </div>

        <a href="/{APK_NAME}" class="btn-download" download="{APK_NAME}">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download life-tracker.apk</span>
        </a>
        <p class="direct-link-hint">Direct link: <a href="/{APK_NAME}" class="text-blue-600 underline font-mono">{download_url}</a></p>
        """
        qr_section_html = f"""
        <div class="qr-card">
          <p class="qr-title">📱 Scan with Phone Camera to Download</p>
          <div class="qr-wrapper">
            <img id="qrImg" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={urllib.parse.quote(download_url)}" alt="Scan QR code to download APK" width="220" height="220" onerror="this.parentElement.innerHTML='<div class=\\'qr-fallback\\'>Point phone camera or browser to: <b>{download_url}</b></div>'" />
          </div>
          <p class="qr-hint">Make sure phone is connected to the same Wi-Fi network.</p>
        </div>
        """
    else:
        file_status_html = f"""
        <div class="warning-box">
          <h3>⚠️ APK Not Found Yet</h3>
          <p>The APK has not been compiled yet or was removed.</p>
          <p class="mt-2">To compile the APK, run in your terminal:</p>
          <code>npm run build:apk</code> or <code>./manage.sh build</code>
          <p class="mt-2 text-sm text-slate-500">Then refresh this page to download!</p>
        </div>
        """
        qr_section_html = ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Life Tracker Android App</title>
  <link rel="icon" type="image/png" href="/life-tracker-logo.png">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #1e293b;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px 16px;
    }}
    .container {{
      width: 100%;
      max-width: 480px;
      background: #ffffff;
      border-radius: 28px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
      padding: 32px 24px;
      text-align: center;
    }}
    .logo-badge {{
      width: 72px;
      height: 72px;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      border-radius: 20px;
      margin: 0 auto 16px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
      color: white;
      font-size: 32px;
    }}
    .logo-badge img {{
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 20px;
    }}
    h1 {{
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }}
    .subtitle {{
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }}
    .feature-tag {{
      display: inline-block;
      margin-top: 10px;
      background: #eff6ff;
      color: #2563eb;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid #bfdbfe;
    }}
    .apk-info-box {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 14px 18px;
      margin: 22px 0 18px 0;
      text-align: left;
    }}
    .apk-info-row {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 12px;
      border-bottom: 1px dashed #e2e8f0;
    }}
    .apk-info-row:last-child {{ border-bottom: none; }}
    .apk-info-row .label {{ color: #64748b; font-weight: 500; }}
    .apk-info-row .value {{ color: #0f172a; font-weight: 700; }}
    .badge-size {{
      background: #10b981;
      color: white;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
    }}
    .btn-download {{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      background: #2563eb;
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 18px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 12px 24px -6px rgba(37, 99, 235, 0.4);
      transition: all 0.2s ease;
      cursor: pointer;
    }}
    .btn-download:hover {{
      background: #1d4ed8;
      transform: translateY(-1px);
      box-shadow: 0 16px 28px -6px rgba(37, 99, 235, 0.5);
    }}
    .btn-download:active {{
      transform: translateY(1px);
    }}
    .icon {{ width: 20px; height: 20px; }}
    .direct-link-hint {{
      font-size: 11px;
      color: #64748b;
      margin-top: 10px;
      word-break: break-all;
    }}
    .qr-card {{
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }}
    .qr-title {{
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}
    .qr-wrapper {{
      display: inline-block;
      padding: 12px;
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    }}
    .qr-wrapper img {{
      display: block;
      border-radius: 12px;
    }}
    .qr-hint {{
      font-size: 11px;
      color: #94a3b8;
      margin-top: 8px;
    }}
    .instructions {{
      margin-top: 24px;
      padding: 16px;
      background: #f1f5f9;
      border-radius: 18px;
      text-align: left;
    }}
    .instructions h4 {{
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }}
    .instructions ol {{
      font-size: 11px;
      color: #475569;
      padding-left: 18px;
      line-height: 1.6;
    }}
    .instructions li {{ margin-bottom: 4px; }}
    .warning-box {{
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 18px;
      padding: 18px;
      color: #991b1b;
      margin: 18px 0;
      text-align: left;
    }}
    .warning-box h3 {{ font-size: 14px; margin-bottom: 6px; }}
    .warning-box code {{
      display: block;
      margin: 8px 0;
      background: #ffffff;
      border: 1px solid #fca5a5;
      padding: 8px 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      color: #111827;
    }}
    footer {{
      margin-top: 20px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-badge">
      <img src="/life-tracker-logo.png" alt="Life Tracker Logo" onerror="this.parentElement.innerHTML='⏰'" />
    </div>
    <h1>Life Tracker</h1>
    <p class="subtitle">Personal Expenses & Phone Alarm Reminders</p>
    <div class="feature-tag">⏰ Real Phone Alarm Clock Enabled</div>

    {file_status_html}

    {qr_section_html}

    <div class="instructions">
      <h4>💡 How to install on your phone</h4>
      <ol>
        <li>Tap <b>Download</b> above (or scan the QR code with your phone camera).</li>
        <li>If your browser warns <i>"File might be harmful"</i>, tap <b>Download anyway</b>.</li>
        <li>Once finished, tap <b>Open</b> &rarr; <b>Install</b>.</li>
        <li>If prompted with <i>"Install unknown apps"</i>, tap <b>Settings</b> and toggle <b>Allow from this source</b>.</li>
      </ol>
    </div>
  </div>

  <footer>
    Serving from: <code>http://{host_ip}:{port}</code><br>
    Life Tracker App &copy; {datetime.now().year}
  </footer>
</body>
</html>
"""
    return html

class ApkDownloadHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean custom logger
        now = datetime.now().strftime("%H:%M:%S")
        sys.stdout.write(f"[{now}] {self.client_address[0]} - {format % args}\n")
        sys.stdout.flush()

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in [f"/{APK_NAME}", "/app-debug.apk"]:
            target_file = APK_PATH if path == f"/{APK_NAME}" else os.path.join(PROJECT_DIR, "app-debug.apk")
            if not os.path.isfile(target_file):
                target_file = APK_PATH

            if os.path.isfile(target_file):
                size = os.path.getsize(target_file)
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.android.package-archive")
                self.send_header("Content-Length", str(size))
                self.send_header("Content-Disposition", f'attachment; filename="{os.path.basename(target_file)}"')
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                return

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Download APK file
        if path in [f"/{APK_NAME}", "/app-debug.apk"]:
            target_file = APK_PATH if path == f"/{APK_NAME}" else os.path.join(PROJECT_DIR, "app-debug.apk")
            if not os.path.isfile(target_file):
                target_file = APK_PATH

            if not os.path.isfile(target_file):
                self.send_error(404, f"APK file not found. Please compile with ./manage.sh build first.")
                return

            try:
                size = os.path.getsize(target_file)
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.android.package-archive")
                self.send_header("Content-Length", str(size))
                self.send_header("Content-Disposition", f'attachment; filename="{os.path.basename(target_file)}"')
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()

                now = datetime.now().strftime("%H:%M:%S")
                print(f"[{now}] 📥 Starting APK transfer to {self.client_address[0]} ({format_size(size)})...")

                with open(target_file, "rb") as f:
                    shutil.copyfileobj(f, self.wfile, length=64 * 1024)

                now = datetime.now().strftime("%H:%M:%S")
                print(f"[{now}] ✅ Finished sending APK to {self.client_address[0]}")
            except (ConnectionResetError, BrokenPipeError):
                print(f"⚠️ Connection reset by client: {self.client_address[0]}")
            except Exception as e:
                print(f"⚠️ Error sending file: {e}")
            return

        # 2. Serve App Logo if requested
        if path == "/life-tracker-logo.png" and os.path.isfile(LOGO_PATH):
            try:
                size = os.path.getsize(LOGO_PATH)
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(size))
                self.end_headers()
                with open(LOGO_PATH, "rb") as f:
                    shutil.copyfileobj(f, self.wfile)
                return
            except Exception:
                pass

        # 3. Serve Download Portal Landing Page
        meta = get_apk_meta()
        host_ip = self.server.server_ip
        port = self.server.server_port
        html = generate_html_page(meta, host_ip, port).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(html)

def run_server(port_arg=None, auto_open=True):
    ensure_apk_exists()
    meta = get_apk_meta()
    local_ip = get_local_ip()

    initial_port = 8080
    if port_arg:
        try:
            initial_port = int(port_arg)
        except ValueError:
            print(f"⚠️ Invalid port '{port_arg}', defaulting to 8080")

    port = find_available_port(initial_port)

    server = HTTPServer(("0.0.0.0", port), ApkDownloadHandler)
    server.server_ip = local_ip
    server.server_port = port

    print("")
    print("=" * 60)
    print("📱 LIFE TRACKER - APK DOWNLOAD SERVER")
    print("=" * 60)
    if meta:
        print(f"📦 APK Available : {meta['name']} ({meta['size_str']})")
        print(f"🕒 Last Modified : {meta['modified']}")
    else:
        print("⚠️ Warning       : No compiled APK found yet. Run ./manage.sh build")
    print("-" * 60)
    print(f"👉 On your Phone (connected to same Wi-Fi):")
    print(f"   \033[1;32mhttp://{local_ip}:{port}\033[0m")
    print("")
    print(f"💻 On this Computer:")
    print(f"   \033[1;34mhttp://localhost:{port}\033[0m")
    print("-" * 60)
    if auto_open:
        print(f"🌐 Opening http://localhost:{port} in your browser...")
    print("💡 Tip: Open the link above to view the download portal and QR code.")
    print("Press Ctrl+C to stop the server anytime.")
    print("=" * 60)
    print("")

    if auto_open:
        def open_browser():
            time.sleep(0.5)
            try:
                webbrowser.open(f"http://localhost:{port}")
            except Exception:
                pass
        threading.Thread(target=open_browser, daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 APK Download Server stopped.")
        server.server_close()

def parse_args():
    parser = argparse.ArgumentParser(description="Life Tracker APK Download Server")
    parser.add_argument("port", nargs="?", default=None, help="Port to listen on (default: 8080 or next available)")
    parser.add_argument("--port", "-p", dest="opt_port", default=None, help="Port to listen on")
    parser.add_argument("--no-open", "-n", dest="no_open", action="store_true", help="Do not open browser automatically")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    target_port = args.opt_port if args.opt_port is not None else args.port
    run_server(port_arg=target_port, auto_open=not args.no_open)
