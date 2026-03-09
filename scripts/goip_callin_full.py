#!/usr/bin/env python3
"""GoIP16 - Call In (ata_in_setting) tam durum raporu"""
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

# ata_in_setting = Call In sayfasi
conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
conn.request('GET', '/default/en_US/config.html?type=ata_in_setting', headers={'Authorization': auth})
data = conn.getresponse().read().decode('utf-8','replace')
conn.close()

print("=== CALL IN (ata_in_setting) - Line1 Ayarlari ===\n")

# Line1 ile ilgili tum input alanlari
for m in re.finditer(r'<input[^>]*name\s*=\s*"([^"]+)"[^>]*>', data, re.I):
    tag = m.group(0)
    name = m.group(1)
    # Sadece line1 ve genel alanlar
    if re.match(r'line[2-9]|line1[0-6]|l[2-9]_|l1[0-6]_', name):
        continue
    if name == 'line_fw_conf_tab':
        continue
    
    type_m = re.search(r'type\s*=\s*"([^"]+)"', tag, re.I)
    typ = type_m.group(1).lower() if type_m else 'text'
    val_m = re.search(r'value\s*=\s*"([^"]*)"', tag, re.I)
    val = val_m.group(1) if val_m else ''
    chk = ' [CHECKED]' if 'checked' in tag.lower() else ''
    
    if typ == 'submit':
        continue
    if typ == 'radio':
        print(f"  {name} = {val}{chk}  ({typ})")
    else:
        print(f"  {name} = '{val}'{chk}  ({typ})")

# Select alanlari - line1 ve genel
print("\n--- Select Alanlari ---")
for sm in re.finditer(r'<select[^>]*name\s*=\s*"([^"]+)"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
    sname = sm.group(1)
    if re.match(r'line[2-9]|line1[0-6]', sname):
        continue
    body = sm.group(2)
    # Find selected
    sv = re.search(r'<option[^>]*selected[^>]*value\s*=\s*"([^"]*)"[^>]*>([^<]*)', body, re.I)
    if sv:
        print(f"  {sname} = '{sv.group(1)}' ({sv.group(2).strip()})")
    else:
        # All options
        opts = re.findall(r'<option[^>]*value\s*=\s*"([^"]*)"[^>]*>([^<]*)', body, re.I)
        print(f"  {sname} = ? (options: {[(o[0], o[1].strip()) for o in opts]})")

# Visible divlar
print("\n--- Visible DIVs (line1 veya genel) ---")
for m in re.finditer(r'id\s*=\s*"([^"]+)"[^>]*class\s*=\s*"visable"', data, re.I):
    did = m.group(1)
    if '_div' in did:
        if 'line1' in did or not re.search(r'line\d', did):
            print(f"  {did}")

# TRUNK_GW_MODE'da Call In nasil calisir?
print("\n=== trunk_gw1 Call In ayarlari ===")
conn2 = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
conn2.request('GET', '/default/en_US/config.html?type=trunk_gw1', headers={'Authorization': auth})
data2 = conn2.getresponse().read().decode('utf-8','replace')
conn2.close()

# Herhangi bir call_in, fw_to_voip, incoming referansi var mi?
for kw in ['call_in', 'fw_to_voip', 'incoming', 'forward', 'inbound', 'route_in', 'accept']:
    for m2 in re.finditer(kw, data2, re.I):
        s = max(0, m2.start()-80)
        e = min(len(data2), m2.end()+80)
        ctx = data2[s:e].replace('\n',' ').replace('\r','')
        print(f"  [{kw}]: {ctx[:200]}")
