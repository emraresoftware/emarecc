#!/usr/bin/env python3
"""GoIP16 - Tam cihaz denetimi / Full device audit"""
import http.client, base64, re, json

auth = 'Basic ' + base64.b64encode(b'admin:admin').decode()
issues = []
info = []

def fetch(page):
    conn = http.client.HTTPConnection('192.168.1.100', 80, timeout=5)
    conn.request('GET', f'/default/en_US/config.html?type={page}', headers={'Authorization': auth})
    data = conn.getresponse().read().decode('utf-8','replace')
    conn.close()
    return data

def get_inputs(data, line_filter='line1'):
    """Line1 ve genel input/radio/checkbox alanlari"""
    vals = {}
    for m in re.finditer(r'<input[^>]*name\s*=\s*"([^"]+)"[^>]*>', data, re.I):
        tag = m.group(0)
        name = m.group(1)
        if line_filter and re.match(r'line[2-9]_|line1[0-6]_|l[2-9]_|l1[0-6]_', name):
            continue
        if name == 'line_fw_conf_tab': continue
        type_m = re.search(r'type\s*=\s*"([^"]+)"', tag, re.I)
        typ = type_m.group(1).lower() if type_m else 'text'
        val_m = re.search(r'value\s*=\s*"([^"]*)"', tag, re.I)
        val = val_m.group(1) if val_m else ''
        chk = 'checked' in tag.lower()
        if typ == 'submit': continue
        if typ == 'radio':
            if chk:
                vals[name] = val
        elif typ == 'checkbox':
            if chk:
                vals[name] = val if val else 'on'
        else:
            vals[name] = val
    return vals

def get_selects(data, line_filter='line1'):
    """Select alanlari - selected değerleri"""
    vals = {}
    for sm in re.finditer(r'<select[^>]*name\s*=\s*"([^"]+)"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
        sname = sm.group(1)
        if line_filter and re.match(r'line[2-9]_|line1[0-6]_|l[2-9]_|l1[0-6]_', sname):
            continue
        body = sm.group(2)
        sv = re.search(r'<option[^>]*selected[^>]*value\s*=\s*"([^"]*)"[^>]*>([^<]*)', body, re.I)
        if sv:
            vals[sname] = (sv.group(1), sv.group(2).strip())
    return vals

def get_visible_divs(data):
    """Visible div'ler"""
    divs = []
    for m in re.finditer(r'id\s*=\s*"([^"]+)"[^>]*class\s*=\s*"visable"', data, re.I):
        divs.append(m.group(1))
    return divs

# ============================================================
# 1. BASIC VOIP (calling) - SIP Trunk ayarlari
# ============================================================
print("=" * 60)
print("1. BASIC VOIP / SIP TRUNK AYARLARI")
print("=" * 60)
data = fetch('calling')
inputs = get_inputs(data, None)
selects = get_selects(data, None)
vdivs = get_visible_divs(data)

# Config mode
mode_divs = [d for d in vdivs if 'MODE' in d]
print(f"  SIP Config Mode: {mode_divs}")

# Trunk GW ayarlari
trunk_fields = {k:v for k,v in inputs.items() if 'trunk' in k.lower() or 'gw' in k.lower()}
for k,v in sorted(trunk_fields.items()):
    print(f"  {k} = '{v}'")

# SIP Config Mode select
for sm in re.finditer(r'<select[^>]*name\s*=\s*"sip_config_mode"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
    sv = re.search(r'<option[^>]*selected[^>]*value\s*=\s*"([^"]*)"', sm.group(1), re.I)
    if sv: print(f"  sip_config_mode = {sv.group(1)}")

info.append("SIP Config: Trunk Gateway Mode aktif")

# ============================================================
# 2. ADVANCE VOIP - SIP detay ayarlari
# ============================================================
print("\n" + "=" * 60)
print("2. ADVANCE VOIP AYARLARI")
print("=" * 60)
data = fetch('advance_calling')
inputs = get_inputs(data, None)
selects = get_selects(data, None)
vdivs = get_visible_divs(data)

important_fields = ['sip_port', 'unanswer_exp', 'sip_reg_exp', 'sip_rc4_key',
                     'sip_stun_server', 'sip_relay_server', 'sip_relay_port']
for f in important_fields:
    if f in inputs:
        v = inputs[f]
        print(f"  {f} = '{v}'")
        if f == 'sip_relay_server' and v and '78.47' in v:
            issues.append(f"ESKI IP: {f} = {v} → temizlenmeli!")
        if f == 'unanswer_exp':
            try:
                if int(v) < 30:
                    issues.append(f"unanswer_exp = {v} çok düşük, 60+ önerilir")
            except: pass

# sip_183 (SIP INVITE Response)
for sm in re.finditer(r'<select[^>]*name\s*=\s*"sip_183"[^>]*>(.*?)</select>', data, re.I|re.DOTALL):
    sv = re.search(r'<option[^>]*selected[^>]*value\s*=\s*"([^"]*)"[^>]*>([^<]*)', sm.group(1), re.I)
    if sv: print(f"  sip_183 = {sv.group(1)} ({sv.group(2).strip()})")

# sip_dtmf type
dtmf_div = [d for d in vdivs if 'dtmf' in d.lower()]
print(f"  DTMF visible: {dtmf_div}")

# NAT
nat_div = [d for d in vdivs if 'nat' in d.lower()]
if nat_div:
    print(f"  NAT visible: {nat_div}")

print(f"  Tüm görünür divler: {vdivs}")

# ============================================================
# 3. MEDIA ayarlari
# ============================================================
print("\n" + "=" * 60)
print("3. MEDIA AYARLARI")
print("=" * 60)
data = fetch('media')
inputs = get_inputs(data, None)
selects = get_selects(data, None)

critical_media = ['rtp_port_lower', 'rtp_port_upper', 'rtp_pkt_len', 'jitter_buffer',
                   'rtp_rc4_key', 'rtp_stun_server', 'rtp_relay_server', 'rtp_relay_port',
                   'symmetric_rtp', 'rtp_dt']
for f in critical_media:
    if f in inputs:
        v = inputs[f]
        print(f"  {f} = '{v}'")
        if '78.47' in str(v):
            issues.append(f"ESKI IP: media/{f} = {v}")

# Codec bilgisi
codecs = [(k,v) for k,v in inputs.items() if 'codec' in k.lower() or 'prefer_codec' in k.lower()]
for k,v in codecs:
    print(f"  {k} = '{v}'")

# ============================================================
# 4. CALL IN ayarlari
# ============================================================
print("\n" + "=" * 60)
print("4. CALL IN (Gelen Cagri) AYARLARI")
print("=" * 60)
data = fetch('ata_in_setting')
inputs = get_inputs(data, 'line1')
selects = get_selects(data, 'line1')
vdivs = get_visible_divs(data)

for k,v in sorted(inputs.items()):
    print(f"  {k} = '{v}'")

# cid_fw_mode div
cid_divs = [d for d in vdivs if 'cid_fw' in d]
print(f"  cid_fw_mode visible: {cid_divs}")

if not inputs.get('line1_fw_num_to_voip'):
    issues.append("UYARI: line1_fw_num_to_voip BOŞ — gelen çağrı yönlendirme hedefi yok!")
    
if inputs.get('line1_fw_to_voip') == 'on':
    info.append("Call In: Forward to VoIP AÇIK ✓")
else:
    issues.append("KRITIK: line1_fw_to_voip KAPALI — gelen çağrılar VoIP'e yönlendirilmez!")

# ============================================================
# 5. CALL IN AUTH
# ============================================================
print("\n" + "=" * 60)
print("5. CALL IN AUTH AYARLARI")
print("=" * 60)
data = fetch('call_in_auth')
inputs = get_inputs(data, 'l1')

for k,v in sorted(inputs.items()):
    if 'l1_' in k or 'line1_' in k or not re.match(r'l\d', k):
        print(f"  {k} = '{v}'")

# Auth mode
vdivs = get_visible_divs(data)
auth_divs = [d for d in vdivs if 'auth' in d.lower()]
print(f"  Auth visible divs: {auth_divs}")

# ============================================================
# 6. CALL OUT ayarlari
# ============================================================
print("\n" + "=" * 60)
print("6. CALL OUT AYARLARI")
print("=" * 60)
data = fetch('ata_setting')
inputs = get_inputs(data, 'line1')

for k,v in sorted(inputs.items()):
    print(f"  {k} = '{v}'")

if inputs.get('line1_fw_to_pstn') == 'on':
    info.append("Call Out: Forward to PSTN/GSM AÇIK ✓")

# ============================================================
# 7. NETWORK ayarlari
# ============================================================
print("\n" + "=" * 60)
print("7. NETWORK AYARLARI")
print("=" * 60)
data = fetch('network')
inputs = get_inputs(data, None)

net_fields = ['wan_mode', 'static_ip', 'static_netmask', 'static_gateway',
              'static_dns1', 'static_dns2', 'hostname']
for f in net_fields:
    if f in inputs:
        print(f"  {f} = '{inputs[f]}'")

# ============================================================
# 8. PREFERENCES
# ============================================================
print("\n" + "=" * 60)
print("8. PREFERENCE AYARLARI")
print("=" * 60)
data = fetch('preference')
inputs = get_inputs(data, None)

pref_fields = ['time_zone', 'ntp_server', 'remote_enable', 'remote_server',
               'remote_server_port', 'http_port', 'http_lan_ae', 'smb_svr',
               'smb_id', 'smb_rmsim', 'smb_net_type', 'auto_reboot',
               'reboot_time', 'ivr_enable', 'rmsim_enable', 'simpipe']
for f in pref_fields:
    if f in inputs:
        v = inputs[f]
        print(f"  {f} = '{v}'")
        if f == 'smb_svr' and v and '78.47' in v:
            issues.append(f"ESKI IP: preference/{f} = {v}")
        if f == 'remote_server' and v and '78.47' not in v and v:
            print(f"    ⚠️  Remote Server: {v}")
        if f == 'ivr_enable' and v == 'on':
            info.append("IVR: AÇIK")
        if f == 'rmsim_enable' and v == 'on':
            issues.append("GÜVENLİK: rmsim_enable (uzak SIM) AÇIK!")

# ============================================================
# 9. SIM FORWARD
# ============================================================
print("\n" + "=" * 60)
print("9. SIM FORWARD AYARLARI")
print("=" * 60)
data = fetch('sim_forward')
inputs = get_inputs(data, 'line1')

for k,v in sorted(inputs.items()):
    print(f"  {k} = '{v}'")

# Check unconditional forwarding
if inputs.get('line1_gsm_cf_uncnd_enable') == '1':
    issues.append("UYARI: Line1 koşulsuz yönlendirme AÇIK!")

# ============================================================
# 10. GSM CARRIER / OPERATOR
# ============================================================
print("\n" + "=" * 60)
print("10. GSM CARRIER AYARLARI")
print("=" * 60)
data = fetch('gsm_oper_setting')
inputs = get_inputs(data, 'line1')
for k,v in sorted(inputs.items()):
    print(f"  {k} = '{v}'")

# ============================================================
# SONUÇ RAPORU
# ============================================================
print("\n" + "=" * 60)
print("SONUÇ RAPORU")
print("=" * 60)

print("\n✅ İYİ OLAN AYARLAR:")
for i in info:
    print(f"  • {i}")

if issues:
    print(f"\n⚠️  SORUNLAR ({len(issues)} adet):")
    for i in issues:
        print(f"  • {i}")
else:
    print("\n✅ Hiç sorun bulunamadı!")
