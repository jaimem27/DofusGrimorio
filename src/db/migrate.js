const AUTH_TABLE_QUERIES = [
  `
  CREATE TABLE IF NOT EXISTS dg_discord_account (
    discord_user_id VARCHAR(32) NOT NULL,
    account_id INT(11) NOT NULL,
    linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_vote DATETIME DEFAULT NULL,
    PRIMARY KEY (discord_user_id, account_id),
    UNIQUE KEY uq_account_owner (account_id)
  ) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS dg_discord_character (
    discord_user_id VARCHAR(32) NOT NULL,
    character_id INT(11) NOT NULL,
    is_main TINYINT(1) NOT NULL DEFAULT 0,
    linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (discord_user_id, character_id)
  ) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS dg_link_attempt (
    discord_user_id VARCHAR(32) NOT NULL,
    account_login VARCHAR(255) NOT NULL,
    success TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_user_time (discord_user_id, created_at)
  ) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS dg_redeem_codes (
    id int(11) NOT NULL AUTO_INCREMENT,
    code varchar(64) NOT NULL,
    max_attempts int(11) NOT NULL DEFAULT 1,
    used_attempts int(11) NOT NULL DEFAULT 0,
    expires_at datetime DEFAULT NULL,
    created_at datetime NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY(id),
    UNIQUE KEY uq_code (code)
  ) ENGINE = MyISAM
  DEFAULT CHARSET = utf8
  COLLATE = utf8_general_ci;
`
  ,
  `
  CREATE TABLE IF NOT EXISTS dg_create_draft (
    discord_user_id VARCHAR(32) NOT NULL,
    payload MEDIUMTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (discord_user_id),
    KEY idx_created_at (created_at)
  ) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `,
];

async function runMigrations(grimPool) {
  const queries = [
    ...AUTH_TABLE_QUERIES,
    `CREATE TABLE IF NOT EXISTS dg_config(
      \`Key\` VARCHAR(64) NOT NULL,
      \`Value\` MEDIUMTEXT NOT NULL,
      PRIMARY KEY(\`Key\`)
    ) ENGINE = MyISAM DEFAULT CHARSET = utf8 COLLATE = utf8_general_ci;
    `,
  ];

  for (const sql of queries) {
    await grimPool.query(sql);
  }

}

async function runAuthMigrations(authPool) {
  for (const sql of AUTH_TABLE_QUERIES) {
    await authPool.query(sql);
  }
}

module.exports = { runMigrations, runAuthMigrations };