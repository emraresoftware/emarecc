#!/usr/bin/env python3
"""GoIP16 - save_config JS fonksiyonunu ve ajaxroutine.js'i incele"""
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

# 1. ajaxroutine.js dosyasini oku
print("=== ajaxroutine.js ===")
try:
    conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
    conn.request('GET', '/default/en_US/ajaxroutine.js', headers={'Authorization': auth})
    resp = conn.getresponse()
    data = resp.read().decode('utf-8','replace')
    conn.close()
    if len(data) > 100:
        print(data[:3000])
    else:
        print(f"Kisa yanit ({len(data)}b): {data}")
except Exception as e:
    print(f"HATA: {e}")

# Try other paths
for path in ['/ajaxroutine.js', '/js/ajaxroutine.js', '/default/ajaxroutine.js']:
    try:
        conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=3)
        conn.request('GET', path, headers={'Authorization': auth})
        resp = conn.getresponse()
        data = resp.read().decode('utf-8','replace')
        conn.close()
        if len(data) > 100:
            print(f"\n=== {path} ({len(data)}b) ===")
            print(data[:2000])
            break
    except:
        pass

# 2. Media sayfasindaki script bloklarini oku
print("\n\n=== media page scripts ===")
conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
conn.request('GET', '/default/en_US/config.html?type=media', headers={'Authorization': auth})
data = conn.getresponse().read().decode('utf-8','replace')
conn.close()

# Find script src references
for m in re.finditer(r'<script[^>]*src\s*=\s*"([^"]+)"', data, re.I):
    print(f"  Script src: {m.group(1)}")

# Find inline scripts containing save_config or ajaxRequest
for m in re.finditer(r'<script[^>]*>(.*?)</script>', data, re.I|re.DOTALL):
    js = m.group(1)
    if 'save_config' in js or 'ajaxRequest' in js or 'XMLHttpRequest' in js:
        # Print relevant parts
        print(f"\n  INLINE SCRIPT ({len(js)}b):")
        # Find save_config function
        sc = re.search(r'function\s+save_config[^{]*\{.*?\n\}', js, re.DOTALL)
        if sc:
            print(sc.group(0)[:1500])
        else:
            # Print lines with save/ajax
            for line in js.split('\n'):
                if any(kw in line.lower() for kw in ['save', 'ajax', 'xmlhttp', 'post', 'submit', 'url']):
                    print(f'    {line.strip()[:200]}')
