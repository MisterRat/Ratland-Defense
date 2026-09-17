"""Ratland Defense — single-file desktop launcher.

Serves the game (index.html + js/ + assets/) over a localhost HTTP server on a
fixed loopback port, then opens it in a native window via pywebview. On Windows
the pywebview default backend is EdgeChromium (WebView2) — an embedded Chromium.

The ``Api`` object is exposed to the page as ``window.pywebview.api`` so the
Stored Levels page can use NATIVE file dialogs (Save / Open) instead of the
in-browser download trick, which WebView2 silently suppresses. In a regular
browser (file:// or a dev server) ``window.pywebview`` is absent and the page
falls back to its Blob/hidden-input paths.

Build the Windows exe with compile.bat (PyInstaller --onefile).
"""
import os
import sys
import threading
import http.server
import socketserver

import webview

HOST = '127.0.0.1'  # loopback only — never expose the game server on the LAN
PORT = 18429        # fixed port ensures localStorage persists across launches
PORT_WAIT_TIMEOUT = 5  # seconds to wait for the server thread to bind


def get_base_dir():
    """Absolute path to the web resources; works in dev and in the PyInstaller
    bundle (which unpacks into sys._MEIPASS)."""
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


class Api:
    """Bridge exposed to JavaScript as ``window.pywebview.api``.

    Only the Stored Levels page uses it (export one / export all / import).
    Methods run on the GUI thread (pywebview marshals js_api calls there),
    which is what the native dialogs require.
    """

    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def save_file(self, content, default_filename='levels.json'):
        """Native Save dialog. Returns True on success, False on cancel/error."""
        if not self._window:
            return False
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_filename,
            file_types=('JSON Files (*.json)', 'All files (*.*)'),
        )
        # Backends return a path string (Windows) or a 1-tuple; None/False on cancel.
        if not result:
            return False
        file_path = result[0] if isinstance(result, (list, tuple)) else result
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
        except OSError:
            return False
        return True

    def open_files(self):
        """Native multi-file Open dialog for importing .json level files.

        Returns a list of ``{'name', 'content'}`` dicts (empty on cancel).
        Files are read here and shipped as JSON — the page never touches disk.
        """
        if not self._window:
            return []
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=True,
            file_types=('JSON Files (*.json)', 'All files (*.*)'),
        )
        # Backends return a list/tuple of paths; None/empty on cancel.
        if isinstance(result, (list, tuple)):
            paths = [p for p in result if p]
        elif result:
            paths = [result]
        else:
            paths = []
        out = []
        for p in paths:
            try:
                with open(p, 'r', encoding='utf-8') as f:
                    out.append({'name': os.path.basename(p), 'content': f.read()})
            except OSError:
                continue  # unreadable file — the page will simply not list it
        return out


def _start_server(base_dir, port_container):
    """Serve base_dir on a fixed loopback port using a multi-threaded server."""
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=base_dir, **kwargs)

    # ThreadingMixIn allows handling concurrent script requests from WebView2
    class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        daemon_threads = True
        allow_reuse_address = True

    with ThreadedHTTPServer((HOST, PORT), Handler) as httpd:
        port_container['port'] = httpd.server_address[1]
        port_container['event'].set()
        httpd.serve_forever()


def main():
    base_dir = get_base_dir()
    port_container = {'port': None, 'event': threading.Event()}

    server_thread = threading.Thread(
        target=_start_server, args=(base_dir, port_container), daemon=True)
    server_thread.start()

    if not port_container['event'].wait(timeout=PORT_WAIT_TIMEOUT):
        print('ERROR: local game server failed to start.', file=sys.stderr)
        sys.exit(1)
    port = port_container['port']

    api = Api()
    window = webview.create_window(
        'Ratland Defense',
        f'http://{HOST}:{port}/index.html',
        resizable=True,
        maximized=True,
        js_api=api,  # expose the native-dialog bridge to the page
    )
    api.set_window(window)

    # Persist storage state under %APPDATA%\RatlandDefense across executable runs
    storage_dir = os.path.join(
        os.getenv('APPDATA', os.path.expanduser('~')), 'RatlandDefense'
    )

    webview.start(private_mode=False, storage_path=storage_dir, debug=False)


if __name__ == '__main__':
    main()
