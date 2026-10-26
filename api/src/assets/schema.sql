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
    -- Bot-owner display settings; default on.
    `showSources` TINYINT(1) NOT NULL DEFAULT 1,
    `autoScrollTop` TINYINT(1) NOT NULL DEFAULT 1,

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
    INDEX(`timecreated`),
    INDEX `idx_bot_timecreated`(`bot_id`, `timecreated`)
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

SET @show_sources_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EmbedBot' AND COLUMN_NAME = 'showSources'
);
SET @show_sources_sql = IF(@show_sources_exists = 0,
    'ALTER TABLE `EmbedBot` ADD COLUMN `showSources` TINYINT(1) NOT NULL DEFAULT 1',
    'SELECT 1');
PREPARE show_sources_stmt FROM @show_sources_sql;
EXECUTE show_sources_stmt;
DEALLOCATE PREPARE show_sources_stmt;

SET @auto_scroll_top_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EmbedBot' AND COLUMN_NAME = 'autoScrollTop'
);
SET @auto_scroll_top_sql = IF(@auto_scroll_top_exists = 0,
    'ALTER TABLE `EmbedBot` ADD COLUMN `autoScrollTop` TINYINT(1) NOT NULL DEFAULT 1',
    'SELECT 1');
PREPARE auto_scroll_top_stmt FROM @auto_scroll_top_sql;
EXECUTE auto_scroll_top_stmt;
DEALLOCATE PREPARE auto_scroll_top_stmt;

-- Composite index for per-bot time-ordered usage-log reads and retention purges.
-- MySQL has no CREATE INDEX IF NOT EXISTS, so guard via INFORMATION_SCHEMA.STATISTICS.
SET @usage_log_bot_time_idx_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EmbedUsageLog' AND INDEX_NAME = 'idx_bot_timecreated'
);
SET @usage_log_bot_time_idx_sql = IF(@usage_log_bot_time_idx_exists = 0,
    'ALTER TABLE `EmbedUsageLog` ADD INDEX `idx_bot_timecreated` (`bot_id`, `timecreated`)',
    'SELECT 1');
PREPARE usage_log_bot_time_idx_stmt FROM @usage_log_bot_time_idx_sql;
EXECUTE usage_log_bot_time_idx_stmt;
DEALLOCATE PREPARE usage_log_bot_time_idx_stmt;
