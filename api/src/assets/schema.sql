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


