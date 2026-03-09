#!/usr/bin/env python3
"""GoIP16 select alanlarinin degerlerini oku - ozellikle gsm_fw_mode ve auth_mode"""
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

pages = ['ata_in_setting', 'call_in_auth', 'advance_calling']

for page in pages:
    try:
        conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
        conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
        data = conn.getresponse().read().decode('utf-8','replace')
        conn.close()
    except Exception as e:
        print(f'=== {page}: ERROR {e} ===')
        continue
    
    print(f'\n=== {page} ({len(data)}b) ===')
    
    # Find ALL select fields with their selected options - include line2+ too for comparison
    for sm in re.finditer(r'<select[^>]*name\s*=\s*"([^"]+)"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
        sname = sm.group(1)
        body = sm.group(2)
        # Find selected option
        sv = re.search(r'<option[^>]*selected[^>]*value\s*=\s*"([^"]*)"', body, re.I)
        if not sv:
            sv = re.search(r'<option\s+selected[^>]*>([^<]*)', body, re.I)
        val = sv.group(1) if sv else '?'
        
        # Also list all options for context
        opts = re.findall(r'<option[^>]*value\s*=\s*"([^"]*)"[^>]*>([^<]*)', body, re.I)
        opts_str = ', '.join([f'{o[0]}={o[1]}' for o in opts[:8]])
        
        # Only show line1 and non-line
        if re.match(r'line[2-9]|line1[0-6]', sname):
            continue
        
        print(f'  [select] {sname} = {val}  (options: {opts_str})')
    
    # Also look for any hidden fields or JS-set values related to answer/ring/early/delay
    for m in re.finditer(r'(auto.?answer|early.?media|ring.?before|answer.?delay|gsm.?answer|pick.?up|auto.?pick)', data, re.I):
        start = max(0, m.start()-100)
        end = min(len(data), m.end()+100)
        ctx = data[start:end].replace('\n',' ').replace('\r','')
        print(f'  [MATCH] {m.group(0)}: ...{ctx}...')
