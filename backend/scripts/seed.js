import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'secret',
  database: process.env.DB_NAME || 'callcenter_db',
});

async function seed() {
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'admin123';
  const adminUser = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const agentUser = process.env.DEFAULT_AGENT_USERNAME || 'agent1';
  const agentUserAlias = process.env.DEFAULT_AGENT_USERNAME_ALIAS || '';
  const supervisorUser = process.env.DEFAULT_SUPERVISOR_USERNAME || 'supervisor';
  const hash = await bcrypt.hash(defaultPassword, 10);

  const upsertDefaultUser = async (username, extension, role) => {
    await pool.query(
      `
      INSERT INTO users (username, password_hash, extension, role, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (extension) DO UPDATE SET
        username = EXCLUDED.username,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = NOW()
      `,
      [username, hash, extension, role, 'ready']
    );
  };

  await upsertDefaultUser(adminUser, '1000', 'admin');
  await upsertDefaultUser(agentUser, '1001', 'agent');
  await upsertDefaultUser(supervisorUser, '1002', 'supervisor');

  // Opsiyonel alias: Daha önce farklı kullanıcı adıyla giriş yapan ajanlar için uyumluluk hesabı
  // Aynı extension kullanılmaz; alias için extension boş bırakılır.
  if (agentUserAlias && agentUserAlias !== agentUser) {
    await pool.query(
      `
      INSERT INTO users (username, password_hash, extension, role, status)
      VALUES ($1, $2, NULL, $3, $4)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = NOW()
      `,
      [agentUserAlias, hash, 'agent', 'ready']
    );
  }

  const defaultScript = `Sayın {{first_name}} {{last_name}}, borcunuzla ilgili arıyorum. Görüşmemiz kayıt altına alınmaktadır. Borç tutarınız {{debt_amount}} TL'dir. Dosya numaranız: {{file_number}}.`;
  const hasDefault = (await pool.query('SELECT 1 FROM scripts WHERE is_default = true LIMIT 1')).rows.length > 0;
  if (!hasDefault) {
    await pool.query('INSERT INTO scripts (name, content, is_default) VALUES ($1, $2, true)', ['Varsayılan Tahsilat', defaultScript]);
  }

  // Varsayılan Asterisk AMI ayarları (panelden düzenlenebilir)
  // Docker: DB_HOST=db → ami_host=asterisk; Local: ami_host=localhost
  const amiHost = process.env.DB_HOST === 'db' ? 'asterisk' : 'localhost';
  const amiSecret = process.env.AMI_SECRET || 'Emre2025**';
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_host', $1, NOW())
     ON CONFLICT (key) DO NOTHING`,
    [amiHost]
  );
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_port', '5038', NOW())
     ON CONFLICT (key) DO NOTHING`
  );
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_user', 'admin', NOW())
     ON CONFLICT (key) DO NOTHING`
  );
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_secret', $1, NOW())
     ON CONFLICT (key) DO NOTHING`,
    [amiSecret]
  );
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('ami_dial_trunk', 'fct-trunk', NOW())
     ON CONFLICT (key) DO NOTHING`
  );

  console.log(
    `Seed complete: ${adminUser}/${defaultPassword}, ${agentUser}/${defaultPassword}, ${supervisorUser}/${defaultPassword}, alias=${agentUserAlias || '-'}, default script, AMI (ami_host=${amiHost}), trunk=fct-trunk`
  );
  await pool.end();
}

seed().catch(console.error);
