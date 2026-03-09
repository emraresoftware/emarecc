#!/usr/bin/env python3
"""GoIP16 - Cookie-based session ile ayar kaydet"""
import http.client, base64, re, urllib.parse

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

# 1. Ilk GET ile session cookie al
conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=10)
conn.request('GET', '/default/en_US/config.html?type=media', headers={'Authorization': auth})
resp = conn.getresponse()
data = resp.read().decode('utf-8','replace')
cookies = resp.getheader('Set-Cookie')
all_headers = resp.getheaders()
conn.close()

print("=== Response Headers ===")
for h in all_headers:
    print(f"  {h[0]}: {h[1]}")

# 2. Tum form elemanlarini topla
values = {}
for m in re.finditer(r'<input[^>]*>', data, re.I):
    tag = m.group(0)
    name_m = re.search(r'name\s*=\s*"([^"]+)"', tag, re.I)
    if not name_m: continue
    name = name_m.group(1)
    type_m = re.search(r'type\s*=\s*"([^"]+)"', tag, re.I)
    typ = type_m.group(1).lower() if type_m else 'text'
    val_m = re.search(r'value\s*=\s*"([^"]*)"', tag, re.I)
    val = val_m.group(1) if val_m else ''
    
    if typ == 'submit': continue
    if typ == 'checkbox':
        if 'checked' in tag.lower():
            values[name] = val if val else 'on'
    elif typ == 'radio':
        if 'checked' in tag.lower():
            values[name] = val
    else:
        values[name] = val

for sm in re.finditer(r'<select[^>]*name\s*=\s*"([^"]+)"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
    sname = sm.group(1)
    body = sm.group(2)
    sv = re.search(r'<option[^>]*selected[^>]*value\s*=\s*"([^"]*)"', body, re.I)
    if sv:
        values[sname] = sv.group(1)
    else:
        fv = re.search(r'<option[^>]*value\s*=\s*"([^"]*)"', body, re.I)
        if fv:
            values[sname] = fv.group(1)

print(f"\n=== Form ({len(values)} alan) ===")
print(f"  rtp_relay_server = '{values.get('rtp_relay_server','')}'")

# 3. Degisiklikleri yap
values['rtp_relay_server'] = ''
values['rtp_relay_port'] = ''
values['rtp_relay_user'] = ''
values['rtp_relay_passwd'] = ''

# 4. POST et (cookie ile)
postdata = urllib.parse.urlencode(values)
headers = {
    'Authorization': auth,
    'Content-Type': 'application/x-www-form-urlencoded',
}
if cookies:
    headers['Cookie'] = cookies.split(';')[0]  # session cookie

print(f"\n=== POST ({len(postdata)}b, cookie: {bool(cookies)}) ===")
conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=10)
conn.request('POST', '/default/en_US/config.html?type=media', body=postdata, headers=headers)
resp = conn.getresponse()
rbody = resp.read().decode('utf-8','replace')
conn.close()
print(f"  Status: {resp.status}")
print(f"  Response size: {len(rbody)}b")

# Check for success/error messages
for kw in ['saved', 'success', 'error', 'fail', 'Configuration']:
    if kw.lower() in rbody.lower():
        idx = rbody.lower().index(kw.lower())
        print(f"  [{kw}]: ...{rbody[max(0,idx-30):idx+50]}...")

# 5. Dogrula
conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
conn.request('GET', '/default/en_US/config.html?type=media', headers={'Authorization': auth})
data2 = conn.getresponse().read().decode('utf-8','replace')
conn.close()
m = re.search(r'name\s*=\s*"rtp_relay_server"[^>]*value\s*=\s*"([^"]*)"', data2, re.I)
if m:
    print(f"\n=== Dogrulama: rtp_relay_server = '{m.group(1)}' ===")
