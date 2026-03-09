#!/usr/bin/env python3
"""GoIP16 eski 78.47.33.186 IP'lerini temizle"""
import http.client, base64, urllib.parse

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

# 1. Media sayfasi - rtp_relay_server temizle
print("=== Media: rtp_relay_server temizleniyor ===")
# GoIP16 form submit format: POST to /default/en_US/config.html?type=media
# Sadece degisen alanlari gonder
media_data = urllib.parse.urlencode({
    'rtp_relay_server': '',
    'rtp_relay_port': '',
    'rtp_relay_user': '',
    'rtp_relay_passwd': '',
})

try:
    conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=10)
    conn.request('POST', '/default/en_US/config.html?type=media', 
                 body=media_data,
                 headers={
                     'Authorization': auth,
                     'Content-Type': 'application/x-www-form-urlencoded'
                 })
    resp = conn.getresponse()
    print(f"  Status: {resp.status} {resp.reason}")
    data = resp.read().decode('utf-8','replace')
    if 'success' in data.lower() or 'saved' in data.lower() or resp.status in (200, 302):
        print("  rtp_relay_server temizlendi!")
    else:
        print(f"  Yanit ({len(data)}b): {data[:200]}")
    conn.close()
except Exception as e:
    print(f"  HATA: {e}")

# 2. Preference sayfasi - smb_svr temizle
print("\n=== Preference: smb_svr temizleniyor ===")
pref_data = urllib.parse.urlencode({
    'smb_svr': '',
    'smb_id': '',
    'smb_key': '',
})

try:
    conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=10)
    conn.request('POST', '/default/en_US/config.html?type=preference',
                 body=pref_data,
                 headers={
                     'Authorization': auth,
                     'Content-Type': 'application/x-www-form-urlencoded'
                 })
    resp = conn.getresponse()
    print(f"  Status: {resp.status} {resp.reason}")
    data = resp.read().decode('utf-8','replace')
    if 'success' in data.lower() or 'saved' in data.lower() or resp.status in (200, 302):
        print("  smb_svr temizlendi!")
    else:
        print(f"  Yanit ({len(data)}b): {data[:200]}")
    conn.close()
except Exception as e:
    print(f"  HATA: {e}")

# 3. Dogrulama - tekrar oku
print("\n=== Dogrulama ===")
import re
for page, field in [('media', 'rtp_relay_server'), ('preference', 'smb_svr')]:
    conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
    conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
    data = conn.getresponse().read().decode('utf-8','replace')
    conn.close()
    m = re.search(rf'name\s*=\s*"{field}"[^>]*value\s*=\s*"([^"]*)"', data, re.I)
    if m:
        val = m.group(1)
        status = "TEMIZ" if not val or val == '' else f"HALA: {val}"
        print(f"  {field} = '{val}' [{status}]")
    else:
        print(f"  {field} = bulunamadi")
