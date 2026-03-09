#!/usr/bin/env python3
"""GoIP16 - trunk_gw1 sayfasinin tam HTML/JS icerigini dump et"""
import http.client, base64

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
conn.request('GET', '/default/en_US/config.html?type=trunk_gw1', headers={'Authorization': auth})
data = conn.getresponse().read().decode('utf-8','replace')
conn.close()

# Print full content
print(data)
