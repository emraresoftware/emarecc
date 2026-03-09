#!/usr/bin/env python3
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

for page in ['ata_in_setting','ata_setting','preference','media','call_in_auth','sim_forward']:
    try:
        conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
        conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
        data = conn.getresponse().read().decode('utf-8','replace')
        conn.close()
    except Exception as e:
        print(f'=== {page}: ERROR {e} ===')
        continue
    
    if len(data) < 500:
        print(f'=== {page}: too small ({len(data)}b) ===')
        continue
    
    print(f'\n=== {page} ({len(data)}b) ===')
    
    # Find all input fields
    for m in re.finditer(r'<input[^>]*name\s*=\s*"([^"]+)"[^>]*>', data, re.I):
        full = m.group(0)
        name = m.group(1)
        val_m = re.search(r'value\s*=\s*"([^"]*)"', full, re.I)
        val = val_m.group(1) if val_m else ''
        checked = 'checked' in full.lower()
        typ_m = re.search(r'type\s*=\s*"([^"]*)"', full, re.I)
        typ = typ_m.group(1) if typ_m else 'text'
        flag = ' [CHECKED]' if checked else ''
        if typ == 'hidden' and not val:
            continue
        # Only show line1 or non-line fields for brevity
        if re.match(r'line[2-9]|line1[0-6]', name):
            continue
        print(f'  [{typ}] {name} = {val}{flag}')
    
    # Find all select fields  
    for sm in re.finditer(r'<select[^>]*name\s*=\s*"([^"]+)"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
        sname = sm.group(1)
        if re.match(r'line[2-9]|line1[0-6]', sname):
            continue
        sv = re.search(r'<option[^>]*selected[^>]*value\s*=\s*"([^"]*)"', sm.group(2), re.I)
        if not sv:
            sv = re.search(r'<option\s+selected[^>]*>([^<]*)', sm.group(2), re.I)
        val = sv.group(1) if sv else '?'
        print(f'  [select] {sname} = {val}')
