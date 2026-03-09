#!/usr/bin/env python3
"""GoIP16 trunk_gw1 ve basic_voip sayfalarindaki JS degiskenlerini oku"""
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

for page in ['trunk_gw1', 'basic_voip']:
    conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
    conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
    data = conn.getresponse().read().decode('utf-8','replace')
    conn.close()
    
    print(f"\n=== {page} ({len(data)}b) ===")
    
    # Find ALL JS variables
    for m in re.finditer(r'var\s+(\w+)\s*=\s*("([^"]*)"|(\d+))', data):
        vname = m.group(1)
        vval = m.group(3) if m.group(3) is not None else m.group(4)
        print(f'  var {vname} = "{vval}"')
    
    # Find JS arrays
    for m in re.finditer(r'var\s+(\w+)\s*=\s*\[([^\]]{1,500})\]', data):
        vname = m.group(1)
        vval = m.group(2)[:200]
        print(f'  var {vname} = [{vval}]')
    
    # Find any reference to registrar, SIP server, trunk mode
    for kw in ['registrar', 'sip_server', 'trunk', 'mode', 'register', 'context', 'incoming', 'inbound']:
        for m in re.finditer(kw, data, re.I):
            s = max(0, m.start()-30)
            e = min(len(data), m.end()+80)
            ctx = data[s:e].replace('\n',' ')
            print(f'  [{kw}] ...{ctx}...')
