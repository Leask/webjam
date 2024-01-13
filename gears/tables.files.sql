CREATE TABLE `files` (
    `id`           VARCHAR(255) NOT NULL,
    `user_id`      VARCHAR(255) NOT NULL,
    `filename`     VARCHAR(255) NOT NULL,
    `originalname` VARCHAR(255) NOT NULL,
    `mimetype`     VARCHAR(255) NOT NULL,
    `size`         BIGINT(20)   NOT NULL,
    `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX user_id      ON files(user_id);
CREATE INDEX filename     ON files(filename);
CREATE INDEX originalname ON files(originalname);
CREATE INDEX mimetype     ON files(mimetype);
CREATE INDEX size         ON files(size);
CREATE INDEX created_at   ON files(created_at);
CREATE INDEX updated_at   ON files(updated_at);
