#!/usr/bin/env python3
"""GoIP16 form action'larini ve submit mekanizmasini bul"""
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

for page in ['media', 'preference']:
    conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
    conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
    data = conn.getresponse().read().decode('utf-8','replace')
    conn.close()
    
    print(f'\n=== {page} ===')
    
    # Find form tags
    for m in re.finditer(r'<form[^>]*>', data, re.I):
        print(f'  FORM: {m.group(0)[:300]}')
    
    # Find submit buttons
    for m in re.finditer(r'<input[^>]*type\s*=\s*"submit"[^>]*>', data, re.I):
        print(f'  SUBMIT: {m.group(0)[:200]}')
    
    # Find JavaScript submit functions
    for m in re.finditer(r'function\s+\w*[Ss]ubmit\w*\s*\([^)]*\)\s*\{[^}]*\}', data, re.I):
        print(f'  JS_SUBMIT: {m.group(0)[:300]}')
    
    # Find onclick handlers with submit
    for m in re.finditer(r'onclick\s*=\s*"[^"]*submit[^"]*"', data, re.I):
        print(f'  ONCLICK: {m.group(0)[:200]}')
    
    # Find save/submit/apply buttons
    for m in re.finditer(r'(save|submit|apply|update|ok)[^<]{0,50}</(button|a|input|td)', data, re.I):
        s = max(0, m.start()-100)
        ctx = data[s:m.end()].replace('\n',' ')
        print(f'  SAVE_BTN: ...{ctx[-200:]}')
    
    # Find action URLs in JS
    for m in re.finditer(r'action\s*=\s*["\']([^"\']+)["\']', data, re.I):
        print(f'  ACTION: {m.group(1)}')
    
    # Find any ajax/fetch/xmlhttp
    for m in re.finditer(r'(XMLHttpRequest|fetch\s*\(|ajax|\.open\s*\(["\'][A-Z]+)', data, re.I):
        s = max(0, m.start()-50)
        e = min(len(data), m.end()+150)
        ctx = data[s:e].replace('\n',' ')
        print(f'  AJAX: ...{ctx[:300]}')
