#!/usr/bin/env python3
"""GoIP16 - visable/invisible div pattern ile select degerlerini tespit et"""
import http.client, base64, re

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

pages = {
    'advance_calling': ['sip_183', 'sip_inv_auth', 'sip_nat_traversal', 'sip_dtmf_type', 
                         'sip_outband_dtmf_type', 'sip_signaling_crypt'],
    'ata_in_setting': ['line1_gsm_fw_mode', 'line1_gsm_cw', 'line1_gsm_group_mode', 'cid_fw_mode'],
    'call_in_auth': ['line1_fw2voip_auth_mode'],
}

for page, fields in pages.items():
    try:
        conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
        conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
        data = conn.getresponse().read().decode('utf-8','replace')
        conn.close()
    except Exception as e:
        print(f'=== {page}: ERROR {e} ===')
        continue
    
    print(f'\n=== {page} ===')
    
    for field in fields:
        # Find all divs with id containing this field name
        pattern = re.compile(
            rf'id\s*=\s*"{re.escape(field)}_([^"]+)_div"[^>]*class\s*=\s*"(visable|invisible)"',
            re.I
        )
        visible_val = None
        invisible_vals = []
        for m in pattern.finditer(data):
            val_suffix = m.group(1)
            vis = m.group(2).lower()
            if vis == 'visable':
                visible_val = val_suffix
            else:
                invisible_vals.append(val_suffix)
        
        if visible_val:
            print(f'  {field} = {visible_val}  (visible div: {field}_{visible_val}_div)')
        elif invisible_vals:
            print(f'  {field} = ? (has invisible divs for: {invisible_vals}, first option likely selected)')
        else:
            print(f'  {field} = ? (no div pattern found)')
    
    # Also find ALL divs with "visable" class to catch any we missed
    print(f'\n  ALL visible divs:')
    for m in re.finditer(r'id\s*=\s*"([^"]+)"[^>]*class\s*=\s*"visable"', data, re.I):
        div_id = m.group(1)
        if '_div' in div_id:
            print(f'    {div_id}')
