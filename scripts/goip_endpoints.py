#!/usr/bin/env python3
"""GoIP16 - Alternatif save endpoint'leri dene"""
import http.client, base64, urllib.parse

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

# Bilinen GoIP endpoint patterolari
endpoints = [
    '/goform/save_config',
    '/goform/config',
    '/goform/save',
    '/goform/media_save',
    '/cgi-bin/save_config',
    '/cgi-bin/config',
    '/default/en_US/save_config.html',
    '/default/en_US/save.html',
    '/save_config',
    '/save',
    '/config.html?type=media',
    '/default/config.html?type=media',
]

test_data = urllib.parse.urlencode({'rtp_relay_server': '', 'test': '1'})

for ep in endpoints:
    try:
        conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=3)
        conn.request('POST', ep, body=test_data, headers={
            'Authorization': auth,
            'Content-Type': 'application/x-www-form-urlencoded'
        })
        resp = conn.getresponse()
        body = resp.read(200).decode('utf-8','replace')
        conn.close()
        status_icon = "OK" if resp.status == 200 else "X"
        print(f"  [{status_icon}] POST {ep} → {resp.status} ({len(body)}b)")
    except Exception as e:
        print(f"  [E] POST {ep} → {e}")

# Also try GET requests to common paths
print("\n=== GET paths ===")
get_paths = [
    '/script/ajaxroutine.js',
    '/script/dynamic.js',
    '/script/dynamic.js?1',
]
for p in get_paths:
    try:
        conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=3)
        conn.request('GET', p, headers={'Authorization': auth})
        resp = conn.getresponse()
        body = resp.read().decode('utf-8','replace')
        conn.close()
        if resp.status == 200 and len(body) > 100:
            print(f"\n  [{resp.status}] GET {p} ({len(body)}b):")
            # Show first 2000 chars
            print(body[:2000])
    except Exception as e:
        print(f"  [E] GET {p} → {e}")
