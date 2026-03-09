#!/usr/bin/env python3
"""GoIP16 - tam form verisi ile ayar guncelle"""
import http.client, base64, re, urllib.parse

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()

def get_all_form_values(page):
    """Sayfadaki tum form elemanlarinin degerlerini oku"""
    conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=10)
    conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
    data = conn.getresponse().read().decode('utf-8','replace')
    conn.close()
    
    values = {}
    
    # Input fields (text, password, hidden)
    for m in re.finditer(r'<input[^>]*>', data, re.I):
        tag = m.group(0)
        name_m = re.search(r'name\s*=\s*"([^"]+)"', tag, re.I)
        if not name_m: continue
        name = name_m.group(1)
        
        type_m = re.search(r'type\s*=\s*"([^"]+)"', tag, re.I)
        typ = type_m.group(1).lower() if type_m else 'text'
        
        val_m = re.search(r'value\s*=\s*"([^"]*)"', tag, re.I)
        val = val_m.group(1) if val_m else ''
        
        if typ == 'checkbox':
            if 'checked' in tag.lower():
                values[name] = val if val else 'on'
        elif typ == 'radio':
            if 'checked' in tag.lower():
                values[name] = val
        elif typ == 'submit':
            continue
        else:
            values[name] = val
    
    # Select fields - find selected option
    for sm in re.finditer(r'<select[^>]*name\s*=\s*"([^"]+)"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
        sname = sm.group(1)
        body = sm.group(2)
        sv = re.search(r'<option[^>]*selected[^>]*value\s*=\s*"([^"]*)"', body, re.I)
        if sv:
            values[sname] = sv.group(1)
        else:
            # Take first option
            fv = re.search(r'<option[^>]*value\s*=\s*"([^"]*)"', body, re.I)
            if fv:
                values[sname] = fv.group(1)
    
    return values

def save_form(page, values):
    """Form verilerini POST et"""
    postdata = urllib.parse.urlencode(values)
    conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=10)
    conn.request('POST', f'/default/en_US/config.html?type={page}',
                 body=postdata,
                 headers={
                     'Authorization': auth,
                     'Content-Type': 'application/x-www-form-urlencoded'
                 })
    resp = conn.getresponse()
    body = resp.read().decode('utf-8','replace')
    conn.close()
    return resp.status, body

# === MEDIA sayfasi ===
print("=== MEDIA sayfasi ===")
vals = get_all_form_values('media')
print(f"Toplam {len(vals)} alan")
print(f"  ONCE  rtp_relay_server = '{vals.get('rtp_relay_server','')}'")
print(f"  ONCE  rtp_relay_port   = '{vals.get('rtp_relay_port','')}'")

# Temizle
vals['rtp_relay_server'] = ''
vals['rtp_relay_port'] = ''
vals['rtp_relay_user'] = ''
vals['rtp_relay_passwd'] = ''

status, body = save_form('media', vals)
print(f"  POST Status: {status}")
if 'saved' in body.lower() or status == 200:
    print("  Kaydedildi!")

# Dogrula
vals2 = get_all_form_values('media')
print(f"  SONRA rtp_relay_server = '{vals2.get('rtp_relay_server','')}'")

# === PREFERENCE sayfasi ===
print("\n=== PREFERENCE sayfasi ===")
vals = get_all_form_values('preference')
print(f"Toplam {len(vals)} alan")
print(f"  ONCE  smb_svr = '{vals.get('smb_svr','')}'")

# Temizle
vals['smb_svr'] = ''
vals['smb_id'] = ''
vals['smb_key'] = ''

status, body = save_form('preference', vals)
print(f"  POST Status: {status}")
if 'saved' in body.lower() or status == 200:
    print("  Kaydedildi!")

# Dogrula
vals2 = get_all_form_values('preference')
print(f"  SONRA smb_svr = '{vals2.get('smb_svr','')}'")
