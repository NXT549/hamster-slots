# serve.py — the tiny local web server that play.bat starts.
#
# It's the same as "python -m http.server", with one change: it tells the browser
# NEVER to cache files ("Cache-Control: no-store"). Without that, a normal refresh
# after editing a .js file can load a mix of old and new files, and the game breaks
# in confusing ways. Only this computer can connect (127.0.0.1).
#
# Usage (from the hamster_slots folder):   python tools/serve.py [port]
# The default port is 8765 (the one play.bat opens).

import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    # Serve the game folder (the parent of tools/), wherever this was started from.
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f'Hamster Slots: http://localhost:{port}/  (close this window to stop)')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
