CREATE DATABASE IF NOT EXISTS %database% CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

USE %database%;

CREATE TABLE IF NOT EXISTS `EmbedBot` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `botName` VARCHAR(128) NOT NULL UNIQUE,
    `botTitle` VARCHAR(128),
    `botSubTitle` VARCHAR(256),
    `botGreeting` VARCHAR(4096),
    `botContact` VARCHAR(512),
    `botIconUrl` VARCHAR(512),
    -- Visibility gate mirrored from Criabot; defaults 0 to fail closed.
    `publish` TINYINT(1) NOT NULL DEFAULT 0,
    `developerMode` VARCHAR(512),
    `botEmbedTheme` VARCHAR(16),
    `botEmbedPosition` VARCHAR(2),
    `botEmbedDefaultEnabled` TINYINT,
    `botWatermark` TINYINT,
    `botLocale` VARCHAR(16),
    `initialPrompts` VARCHAR(4096),
    `botTrustWarning` VARCHAR(256),
    `embedHoverTooltip` VARCHAR(256),
    `integrationsNoContextReply` TINYINT,
    `integrationsFirstEmailOnly` TINYINT,
    `integrationsWhitelistFilter` VARCHAR(256),

    # Microsoft App ID
    `microsoftAppId` VARCHAR(128) UNIQUE,
    `microsoftAppPassword` VARCHAR(128),

    `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    INDEX(`microsoftAppId`)

);

CREATE TABLE IF NOT EXISTS `EmbedUsageLog` (
    `id`                BIGINT AUTO_INCREMENT PRIMARY KEY,
    `bot_id`            BIGINT NULL DEFAULT 0,
    `userid`            BIGINT NULL DEFAULT 0,
    `prompt`            LONGTEXT NULL,
    `message`           LONGTEXT NULL,
    `index_context`     LONGTEXT NULL,
    `confidence`        SMALLINT NULL DEFAULT 0,
    `prompt_tokens`     BIGINT NULL DEFAULT 0,
    `completion_tokens` BIGINT NULL DEFAULT 0,
    `total_tokens`      BIGINT NULL DEFAULT 0,
    `cost`              DECIMAL(12, 6) NULL DEFAULT 0.000000,
    `payload`           LONGTEXT NULL,
    `ip`                VARCHAR(45) NULL,
    `other`             LONGTEXT NULL,
    `timecreated`       BIGINT NULL DEFAULT 0,

    INDEX(`bot_id`),
    INDEX(`userid`),
    INDEX(`timecreated`)
);



-- schema.sql is CREATE TABLE IF NOT EXISTS, so existing installs need an explicit
-- add for new columns. Guarded so re-running the bootstrap stays idempotent.
SET @publish_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EmbedBot' AND COLUMN_NAME = 'publish'
);
SET @publish_sql = IF(@publish_exists = 0,
    'ALTER TABLE `EmbedBot` ADD COLUMN `publish` TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1');
PREPARE publish_stmt FROM @publish_sql;
EXECUTE publish_stmt;
DEALLOCATE PREPARE publish_stmt;

SET @developer_mode_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EmbedBot' AND COLUMN_NAME = 'developerMode'
);
SET @developer_mode_sql = IF(@developer_mode_exists = 0,
    'ALTER TABLE `EmbedBot` ADD COLUMN `developerMode` VARCHAR(512) NULL',
    'SELECT 1');
PREPARE developer_mode_stmt FROM @developer_mode_sql;
EXECUTE developer_mode_stmt;
DEALLOCATE PREPARE developer_mode_stmt;

SET @personalization_payload_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EmbedBot' AND COLUMN_NAME = 'personalizationPayload'
);
SET @personalization_payload_sql = IF(@personalization_payload_exists = 0,
    'ALTER TABLE `EmbedBot` ADD COLUMN `personalizationPayload` TEXT NULL',
    'SELECT 1');
PREPARE personalization_payload_stmt FROM @personalization_payload_sql;
EXECUTE personalization_payload_stmt;
DEALLOCATE PREPARE personalization_payload_stmt;
