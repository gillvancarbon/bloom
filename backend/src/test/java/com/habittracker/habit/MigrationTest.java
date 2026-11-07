package com.habittracker.habit;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the Flyway migrations (the schema used by the prod profile) apply
 * cleanly from an empty database and leave every column the app reads.
 */
class MigrationTest {

    private static Flyway flyway(String database) {
        return Flyway.configure()
                .dataSource("jdbc:h2:mem:" + database + ";DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE", "sa", "")
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load();
    }

    @Test
    void migratesFromEmptyToTheLatestSchema() throws Exception {
        Flyway flyway = flyway("bloom-schema");
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(6);

        MigrationInfo[] applied = flyway.info().applied();
        assertThat(applied).hasSize(6);
        assertThat(applied[applied.length - 1].getVersion().getVersion()).isEqualTo("6");

        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:bloom-schema;DB_CLOSE_DELAY=-1", "sa", "")) {
            assertThat(columns(connection, "TODOS"))
                    .contains("RECURRENCE", "SUBTASKS", "IMPORTANCE", "IS_ARCHIVED", "DUE_TIME");
            assertThat(columns(connection, "HABITS"))
                    .contains("REMINDER_OFFSET", "TIME_OF_DAY", "SCHEDULE_TYPE", "REMINDER_TIME", "TARGET");
            assertThat(columns(connection, "HABIT_COMPLETIONS"))
                    .contains("HABIT_ID", "COMPLETED_DATE");
            assertThat(columns(connection, "HABIT_FROZEN"))
                    .contains("HABIT_ID", "FROZEN_DATE");
        }
    }

    @Test
    void existingRowsPickUpSafeDefaults() throws Exception {
        String url = "jdbc:h2:mem:bloom-defaults;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE";
        flyway("bloom-defaults").migrate();

        try (Connection connection = DriverManager.getConnection(url, "sa", "");
             Statement statement = connection.createStatement()) {
            // Insert only the baseline columns, as an older app would have.
            statement.executeUpdate("""
                    INSERT INTO todos (title, category, is_done, created_at)
                    VALUES ('Legacy task', 'personal', FALSE, CURRENT_TIMESTAMP)
                    """);

            try (ResultSet row = statement.executeQuery("""
                    SELECT recurrence, importance, is_archived, subtasks
                    FROM todos WHERE title = 'Legacy task'
                    """)) {
                assertThat(row.next()).isTrue();
                assertThat(row.getString("recurrence")).isEqualTo("none");
                assertThat(row.getString("importance")).isEqualTo("medium");
                assertThat(row.getBoolean("is_archived")).isFalse();
                assertThat((Object) row.getString("subtasks")).isNull();
            }
        }
    }

    private Set<String> columns(Connection connection, String table) throws Exception {
        Set<String> names = new HashSet<>();
        // H2 stores unquoted identifiers in upper case.
        try (ResultSet rows = connection.getMetaData().getColumns(null, "PUBLIC", table, null)) {
            while (rows.next()) {
                names.add(rows.getString("COLUMN_NAME").toUpperCase());
            }
        }
        return names;
    }
}
