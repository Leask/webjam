CREATE TABLE `tokens` (
    `id`         VARCHAR(255) NOT NULL,
    `user_id`    VARCHAR(255) NOT NULL,
    `type`       VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expired_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX user_id    ON tokens(user_id);
CREATE INDEX type       ON tokens(type);
CREATE INDEX created_at ON tokens(created_at);
CREATE INDEX updated_at ON tokens(updated_at);
CREATE INDEX expired_at ON tokens(expired_at);
