#!/usr/bin/env python3
"""GoIP16 - JavaScript ile ayarlanan select degerlerini bul"""
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

# Kritik ayarlar icin JS degerlerini ara
pages = ['advance_calling', 'ata_in_setting', 'call_in_auth']

for page in pages:
    try:
        conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
        conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
        data = conn.getresponse().read().decode('utf-8','replace')
        conn.close()
    except Exception as e:
        print(f'=== {page}: ERROR {e} ===')
        continue
    
    print(f'\n=== {page} ===')
    
    # Method 1: Look for JS that sets .value or .selectedIndex
    # Common pattern: document.getElementById("fieldname").value = "xxx"
    # or: form.fieldname.value = "xxx"
    targets = ['sip_183', 'sip_inv_auth', 'sip_dtmf_type', 'sip_nat_traversal',
               'line1_gsm_cw', 'line1_gsm_group_mode', 'line1_gsm_fw_mode',
               'cid_fw_mode', 'line1_fw2voip_auth_mode']
    
    for t in targets:
        # Search for any reference to this field name in JS
        pattern = re.compile(re.escape(t) + r'[^;]{0,200}', re.I)
        for m in pattern.finditer(data):
            ctx = m.group(0).strip()
            if '<option' in ctx or '<select' in ctx:
                continue  # Skip HTML definitions
            if len(ctx) > 5:
                print(f'  JS: {ctx[:200]}')
    
    # Method 2: Look for script blocks that set values
    for script in re.finditer(r'<script[^>]*>(.*?)</script>', data, re.I|re.DOTALL):
        js = script.group(1)
        # Look for value assignments
        for vm in re.finditer(r'(\w+)\s*[.]\s*value\s*=\s*["\']?([^"\';\s]+)', js):
            fname = vm.group(1)
            fval = vm.group(2)
            if fname in targets or any(t in fname for t in targets):
                print(f'  SET: {fname}.value = {fval}')
        # selectedIndex
        for vm in re.finditer(r'(\w+)\s*[.]\s*selectedIndex\s*=\s*(\d+)', js):
            fname = vm.group(1)
            fval = vm.group(2)
            print(f'  SET: {fname}.selectedIndex = {fval}')
    
    # Method 3: Look for data variables that hold config values
    # GoIP often has var xxx = "value"; at top of page
    for vm in re.finditer(r'var\s+(\w+)\s*=\s*"([^"]*)"', data):
        vname = vm.group(1)
        vval = vm.group(2)
        if any(t in vname for t in ['sip_183', 'gsm_fw', 'gsm_cw', 'auth_mode', 'cid_fw', 'fw2voip', 'inv_auth']):
            print(f'  VAR: {vname} = "{vval}"')
    
    # Method 4: Look for any cfg_ or setting_ prefixed vars
    for vm in re.finditer(r'var\s+(cfg_|setting_|conf_|g_)(\w+)\s*=\s*"?([^";]+)"?', data):
        print(f'  CFG: {vm.group(1)}{vm.group(2)} = {vm.group(3).strip()}')
