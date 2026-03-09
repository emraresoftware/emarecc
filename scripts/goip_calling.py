#!/usr/bin/env python3
"""GoIP16 'calling' (Basic VoIP) sayfasindaki SIP konfigurasyonunu oku"""
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
conn.request('GET', '/default/en_US/config.html?type=calling', headers={'Authorization': auth})
data = conn.getresponse().read().decode('utf-8','replace')
conn.close()

print(f"=== calling (Basic VoIP) ({len(data)}b) ===\n")

# Get ALL input fields (not filtering line2+)
for m in re.finditer(r'<input[^>]*name\s*=\s*"([^"]+)"[^>]*>', data, re.I):
    tag = m.group(0)
    name = m.group(1)
    val_m = re.search(r'value\s*=\s*"([^"]*)"', tag, re.I)
    val = val_m.group(1) if val_m else ''
    chk = ' [CHECKED]' if 'checked' in tag.lower() else ''
    typ_m = re.search(r'type\s*=\s*"([^"]*)"', tag, re.I)
    typ = typ_m.group(1) if typ_m else 'text'
    if typ == 'submit': continue
    # Only show non-line, line1, or single fields
    if re.match(r'line[2-9]_|line1[0-6]_', name): continue
    print(f'  [{typ:8s}] {name} = {val}{chk}')

# Get ALL select fields
for sm in re.finditer(r'<select[^>]*name\s*=\s*"([^"]+)"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
    sname = sm.group(1)
    if re.match(r'line[2-9]_|line1[0-6]_', sname): continue
    body = sm.group(2)
    sv = re.search(r'option[^>]*selected[^>]*value\s*=\s*"([^"]*)"', body, re.I)
    val = sv.group(1) if sv else '?'
    opts = re.findall(r'<option[^>]*value\s*=\s*"([^"]*)"[^>]*>([^<]*)', body, re.I)
    print(f'  [select ] {sname} = {val}  opts: {[(o[0],o[1].strip()) for o in opts[:6]]}')

# Search for specific SIP-related keywords
print("\n=== SIP related fields ===")
for kw in ['sip_registrar', 'sip_phone', 'sip_display', 'sip_auth', 'sip_server', 'sip_proxy', 'sip_user', 'sip_pass', 'sip_port']:
    for m in re.finditer(kw + r'[^<]{0,200}', data, re.I):
        ctx = m.group(0).replace('\n',' ')[:200]
        if 'name=' in ctx or 'value=' in ctx:
            print(f'  {ctx}')
