CREATE DATABASE IF NOT EXISTS criaembed CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

USE criaembed;

CREATE TABLE IF NOT EXISTS `EmbedBot` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `botName` VARCHAR(128) NOT NULL UNIQUE,
    `botTitle` VARCHAR(128),
    `botSubTitle` VARCHAR(256),
    `botGreeting` VARCHAR(4096),
    `botIconUrl` VARCHAR(512),
    `botEmbedTheme` VARCHAR(16),
    `botEmbedPosition` VARCHAR(2),
    `botEmbedDefaultEnabled` TINYINT,
    `botWatermark` TINYINT,
    `botLocale` VARCHAR(16),
    `initialPrompts` VARCHAR(4096),
    `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

