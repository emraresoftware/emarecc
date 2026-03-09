#!/usr/bin/env python3
"""GoIP16 Trunk Gateway konfigürasyonunu oku"""
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

# trunk_gw1 sayfasi
conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
conn.request('GET', '/default/en_US/config.html?type=trunk_gw1', headers={'Authorization': auth})
data = conn.getresponse().read().decode('utf-8','replace')
conn.close()

print(f"=== trunk_gw1 ({len(data)}b) ===")

# Input fields
for m in re.finditer(r'<input[^>]*name\s*=\s*"([^"]+)"[^>]*>', data, re.I):
    tag = m.group(0)
    name = m.group(1)
    val_m = re.search(r'value\s*=\s*"([^"]*)"', tag, re.I)
    val = val_m.group(1) if val_m else ''
    chk = ' [CHECKED]' if 'checked' in tag.lower() else ''
    typ_m = re.search(r'type\s*=\s*"([^"]*)"', tag, re.I)
    typ = typ_m.group(1) if typ_m else 'text'
    if typ == 'submit': continue
    print(f'  [{typ}] {name} = {val}{chk}')

# Select fields
for sm in re.finditer(r'<select[^>]*name\s*=\s*"([^"]+)"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
    sname = sm.group(1)
    body = sm.group(2)
    sv = re.search(r'option[^>]*selected[^>]*value\s*=\s*"([^"]*)"', body, re.I)
    val = sv.group(1) if sv else '?'
    opts = re.findall(r'<option[^>]*value\s*=\s*"([^"]*)"[^>]*>([^<]*)', body, re.I)
    print(f'  [SEL] {sname} = {val}  ({[(o[0],o[1].strip()) for o in opts[:8]]})')

# Also check Basic VoIP page
print("\n=== basic_voip ===")
for page in ['basic_voip', 'voip', 'sip']:
    try:
        conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=3)
        conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
        resp = conn.getresponse()
        d2 = resp.read().decode('utf-8','replace')
        conn.close()
        if resp.status == 200 and len(d2) > 1000:
            print(f"  Found: {page} ({len(d2)}b)")
            for m in re.finditer(r'<input[^>]*name\s*=\s*"([^"]+)"[^>]*>', d2, re.I):
                tag = m.group(0)
                name = m.group(1)
                val_m = re.search(r'value\s*=\s*"([^"]*)"', tag, re.I)
                val = val_m.group(1) if val_m else ''
                chk = ' [CHECKED]' if 'checked' in tag.lower() else ''
                typ_m = re.search(r'type\s*=\s*"([^"]*)"', tag, re.I)
                typ = typ_m.group(1) if typ_m else 'text'
                if typ == 'submit': continue
                if re.match(r'line[2-9]|line1[0-6]', name): continue
                print(f'  [{typ}] {name} = {val}{chk}')
            for sm in re.finditer(r'<select[^>]*name\s*=\s*"([^"]+)"[^>]*>(.*?)</select>', d2, re.I|re.DOTALL):
                sname = sm.group(1)
                body = sm.group(2)
                sv = re.search(r'option[^>]*selected[^>]*value\s*=\s*"([^"]*)"', body, re.I)
                val = sv.group(1) if sv else '?'
                opts = re.findall(r'<option[^>]*value\s*=\s*"([^"]*)"[^>]*>([^<]*)', body, re.I)
                print(f'  [SEL] {sname} = {val}  ({[(o[0],o[1].strip()) for o in opts[:6]]})')
            break
    except:
        pass
