/**
 * GoIP16 GSM Gateway Servis Katmanı
 * GoIP16 web API'si ile haberleşerek canlı port/hat bilgilerini çeker
 */

import http from 'http';

const GOIP_HOST = process.env.GOIP_HOST || '192.168.1.100';
const GOIP_USER = process.env.GOIP_USER || 'admin';
const GOIP_PASS = process.env.GOIP_PASS || 'admin';

const AUTH_HEADER = 'Basic ' + Buffer.from(`${GOIP_USER}:${GOIP_PASS}`).toString('base64');

// GoIP16 host:port parse
function parseGoipHost(): { hostname: string; port: number } {
  const parts = GOIP_HOST.split(':');
  return {
    hostname: parts[0],
    port: parseInt(parts[1] || '80', 10),
  };
}

/**
 * GoIP16'dan HTTP ile veri çeker (insecureHTTPParser ile — GoIP non-standard HTTP döner)
 */
function goipRequest(path: string): Promise<string> {
  const { hostname, port } = parseGoipHost();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname,
        port,
        path,
        method: 'GET',
        headers: { Authorization: AUTH_HEADER },
        timeout: 8000,
        insecureHTTPParser: true,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GoIP16 bağlantı zaman aşımı'));
    });
    req.end();
  });
}

interface GoipLineStatus {
  line: number;
  gsm_sim: string;
  gsm_status: string;
  gsm_signal: string;
  gsm_cur_oper: string;
  line_state: string;
  call_count: string;
  last_call_date: string;
  voip_status: string;
}

/**
 * GoIP16 status sayfasını parse ederek tüm hatların durumunu döner
 */
export async function getGoipAllLineStatus(): Promise<GoipLineStatus[]> {
  try {
    const html = await goipRequest('/default/en_US/status.html?type=list');
    const lines: GoipLineStatus[] = [];

    for (let i = 1; i <= 16; i++) {
      lines.push({
        line: i,
        gsm_sim: extractField(html, `l${i}_gsm_sim`),
        gsm_status: extractField(html, `l${i}_gsm_status`),
        gsm_signal: extractField(html, `l${i}_gsm_signal`),
        gsm_cur_oper: extractField(html, `l${i}_gsm_cur_oper`),
        line_state: extractField(html, `l${i}_line_state`),
        call_count: extractField(html, `l${i}_callc`),
        last_call_date: extractField(html, `l${i}_cdrt`),
        voip_status: extractField(html, `l${i}_status_line`),
      });
    }
    return lines;
  } catch (err: any) {
    throw new Error(`GoIP16 erişim hatası: ${err.message}`);
  }
}

/**
 * Tek bir hattın durumunu döner
 */
export async function getGoipLineStatus(line: number): Promise<GoipLineStatus> {
  const allLines = await getGoipAllLineStatus();
  const found = allLines.find((l) => l.line === line);
  if (!found) throw new Error(`Hat ${line} bulunamadı`);
  return found;
}

/**
 * GoIP16 cihaz bilgilerini döner
 */
export async function getGoipDeviceInfo(): Promise<{
  serial: string;
  firmware: string;
  model: string;
  time: string;
  mac: string;
  ip: string;
  dns: string;
}> {
  const html = await goipRequest('/default/en_US/status.html?type=list');
  return {
    serial: extractField(html, 'sn'),
    firmware: extractField(html, 'version'),
    model: extractField(html, 'model'),
    time: extractField(html, 'time'),
    mac: extractField(html, 'eth0_hwaddr'),
    ip: extractField(html, 'last_ip'),
    dns: extractField(html, 'dns'),
  };
}

/**
 * GoIP16 GSM modülünü restart eder
 */
export async function restartGoipLine(line: number): Promise<boolean> {
  try {
    // Modülü kapat
    await goipRequest(`/default/en_US/status.html?type=list&down=1&line=${line}`);
    // 3 saniye bekle
    await new Promise((r) => setTimeout(r, 3000));
    // Modülü aç
    await goipRequest(`/default/en_US/status.html?type=list&down=0&line=${line}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * HTML'den id bazlı field değerini çıkarır
 */
function extractField(html: string, fieldId: string): string {
  const regex = new RegExp(`id="${fieldId}"[^>]*>([^<]*)`, 'i');
  const match = html.match(regex);
  if (!match) return '';
  return match[1].replace(/&nbsp;/g, '').trim();
}
