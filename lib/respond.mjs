import { alan, dbio, uoid, utilitas } from 'utilitas';

const table = 'responds';

const getRespondSql = async () => {
    return {
        [dbio.MYSQL]: [[
            dbio.cleanSql(`CREATE TABLE IF NOT EXISTS ?? (
            \`id\`            VARCHAR(255) NOT NULL,
            \`object_class\`  VARCHAR(255) DEFAULT NULL,
            \`object_id\`     VARCHAR(255) DEFAULT NULL,
            \`respond_type\`  VARCHAR(255) DEFAULT NULL,
            \`respond_value\` VARCHAR(255) DEFAULT NULL,
            \`created_by\`    VARCHAR(255) NOT NULL,
            \`updated_by\`    VARCHAR(255) NOT NULL,
            \`created_at\`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY                  (\`id\`),
            INDEX          object_class  (\`object_class\`),
            INDEX          object_id     (\`object_id\`),
            INDEX          respond_type  (\`respond_type\`),
            INDEX          respond_value (\`respond_value\`),
            INDEX          created_by    (\`created_by\`),
            INDEX          updated_by    (\`updated_by\`),
            INDEX          created_at    (\`created_at\`),
            INDEX          updated_at    (\`updated_at\`),
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`), [table],
        ]],
        [dbio.POSTGRESQL]: [[
            dbio.cleanSql(`CREATE TABLE IF NOT EXISTS "${table}" (
            "id"               VARCHAR(255) NOT NULL,
            "object_class"             VARCHAR(255) DEFAULT NULL,
            "object_id"      VARCHAR(255) DEFAULT NULL,
            "respond_type"           VARCHAR(255) DEFAULT NULL,
            "respond_value"           SMALLINT     NOT NULL DEFAULT 0,
            "created_by"       VARCHAR(255) NOT NULL,
            "updated_by"       VARCHAR(255) NOT NULL,
            "created_at"       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at"       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("id")
        )`)
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_object_class_index" ON "${table}" ("object_class")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_object_id_index" ON "${table}" ("object_id")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_respond_type_index" ON "${table}" ("respond_type")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_respond_value_index" ON "${table}" ("respond_value")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_created_by_index" ON "${table}" ("created_by")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_updated_by_index" ON "${table}" ("updated_by")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_created_at_index" ON "${table}" ("created_at")`,
        ], [
            `CREATE INDEX IF NOT EXISTS "${table}_updated_at_index" ON "${table}" ("updated_at")`,
        ], [
            `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_object_respond_creator_index" ON "${table}" ("object_class", "object_id", "respond_type", "created_by")`,
        ]],
    };
};


export {

};
