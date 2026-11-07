package com.habittracker.habit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration tests for the whole-dataset operations, run against an in-memory
 * database so the real {@code @Transactional} boundaries (and rollback) apply.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:bloom-data-service;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false"
})
class DataServiceTest {

    @Autowired
    private DataService dataService;

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private TodoRepository todoRepository;

    @Autowired
    private AppMetaRepository appMetaRepository;

    @Autowired
    private CalendarService calendarService;

    @BeforeEach
    void clean() {
        habitRepository.deleteAll();
        todoRepository.deleteAll();
        appMetaRepository.deleteAll();
    }

    @Test
    void importPreservesEveryHabitAndTodoField() {
        dataService.importData(fullRequest());

        Habit habit = habitRepository.findAll().get(0);
        assertThat(habit.getId()).isNotNull();
        assertThat(habit.getName()).isEqualTo("Read");
        assertThat(habit.getColorIndex()).isEqualTo(2);
        assertThat(habit.getDeadline()).isEqualTo("18:00");
        assertThat(habit.getSchedule())
                .containsEntry("type", "weekdays")
                .containsEntry("days", List.of(1, 2, 3, 4, 5));
        assertThat(habit.getCategory()).isEqualTo("Mind");
        assertThat(habit.getTimeOfDay()).isEqualTo("evening");
        assertThat(habit.getReminderOffset()).isEqualTo(30);
        assertThat(habit.getOrder()).isEqualTo(3);
        assertThat(habit.isArchived()).isFalse();
        assertThat(habit.getTarget()).isEqualTo(1);
        assertThat(habit.getStreakCount()).isEqualTo(12);
        assertThat(habit.getLastCompletedDate()).isEqualTo(LocalDate.of(2026, 1, 5));
        assertThat(habit.getHistory()).containsExactly("2026-01-03", "2026-01-04", "2026-01-05");
        assertThat(habit.getFrozen()).containsExactly("2026-01-02");
        assertThat(habit.getCreatedAt()).isEqualTo(LocalDateTime.of(2026, 1, 1, 8, 30));

        Todo todo = todoRepository.findAll().get(0);
        assertThat(todo.getId()).isNotNull();
        assertThat(todo.getTitle()).isEqualTo("Pay rent");
        assertThat(todo.getNote()).isNull();
        assertThat(todo.getCategory()).isEqualTo("errands");
        assertThat(todo.getDueDate()).isEqualTo(LocalDate.of(2026, 2, 1));
        assertThat(todo.getDueTime()).isEqualTo(LocalTime.of(9, 0));
        assertThat(todo.getImportance()).isEqualTo("high");
        assertThat(todo.getRecurrence()).isEqualTo("monthly");
        assertThat(todo.getSubtasks()).hasSize(1);
        assertThat(todo.getSubtasks().get(0).getTitle()).isEqualTo("Find bill");
        assertThat(todo.getSubtasks().get(0).isDone()).isTrue();
        assertThat(todo.isDone()).isTrue();
        assertThat(todo.getCompletedAt()).isEqualTo(LocalDateTime.of(2026, 1, 20, 10, 0));
        assertThat(todo.isArchived()).isFalse();
        assertThat(todo.getCreatedAt()).isEqualTo(LocalDateTime.of(2026, 1, 1, 8, 30));
    }

    @Test
    void failingImportLeavesThePreviousDatasetIntact() {
        dataService.importData(fullRequest());
        long habitsBefore = habitRepository.count();
        long todosBefore = todoRepository.count();

        ImportRequest.HabitImport blank = readHabit();
        blank.setName("   ");
        ImportRequest bad = new ImportRequest();
        bad.setHabits(List.of(blank));
        bad.setTodos(List.of());

        assertThatThrownBy(() -> dataService.importData(bad))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(habitRepository.count()).isEqualTo(habitsBefore);
        assertThat(todoRepository.count()).isEqualTo(todosBefore);
        assertThat(habitRepository.findAll().get(0).getName()).isEqualTo("Read");
        assertThat(todoRepository.findAll().get(0).getTitle()).isEqualTo("Pay rent");
    }

    @Test
    void clearAllRemovesEverythingAndResetsHistoryStart() {
        dataService.importData(fullRequest());
        appMetaRepository.save(new AppMeta(CalendarService.HISTORY_START_KEY, "2020-01-01"));

        dataService.clearAll();

        assertThat(habitRepository.count()).isZero();
        assertThat(todoRepository.count()).isZero();
        assertThat(calendarService.getHistoryStart()).isEqualTo(LocalDate.now().toString());
    }

    @Test
    void importRejectsMissingArrays() {
        assertThatThrownBy(() -> dataService.importData(null))
                .isInstanceOf(IllegalArgumentException.class);

        ImportRequest missingTodos = new ImportRequest();
        missingTodos.setHabits(List.of());
        assertThatThrownBy(() -> dataService.importData(missingTodos))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private ImportRequest fullRequest() {
        ImportRequest request = new ImportRequest();
        request.setHabits(List.of(readHabit()));
        request.setTodos(List.of(payRentTodo()));
        return request;
    }

    private ImportRequest.HabitImport readHabit() {
        ImportRequest.HabitImport habit = new ImportRequest.HabitImport();
        habit.setName("Read");
        habit.setColorIndex(2);
        habit.setDeadline("18:00");
        ImportRequest.ScheduleImport schedule = new ImportRequest.ScheduleImport();
        schedule.setType("weekdays");
        schedule.setDays(List.of(1, 2, 3, 4, 5));
        habit.setSchedule(schedule);
        habit.setCategory("Mind");
        habit.setTimeOfDay("evening");
        habit.setReminderOffset(30);
        habit.setOrder(3);
        habit.setArchived(false);
        habit.setTarget(1);
        habit.setStreakCount(12);
        habit.setLastCompletedDate(LocalDate.of(2026, 1, 5));
        habit.setHistory(List.of(
                LocalDate.of(2026, 1, 3),
                LocalDate.of(2026, 1, 4),
                LocalDate.of(2026, 1, 5)));
        habit.setFrozen(List.of(LocalDate.of(2026, 1, 2)));
        habit.setCreatedAt(OffsetDateTime.parse("2026-01-01T08:30:00.000Z"));
        return habit;
    }

    private ImportRequest.TodoImport payRentTodo() {
        ImportRequest.TodoImport todo = new ImportRequest.TodoImport();
        todo.setTitle("Pay rent");
        todo.setNote(null);
        todo.setCategory("errands");
        todo.setDueDate(LocalDate.of(2026, 2, 1));
        todo.setDueTime(LocalTime.of(9, 0));
        todo.setImportance("high");
        todo.setRecurrence("monthly");
        todo.setSubtasks(List.of(new Subtask("s1", "Find bill", true)));
        todo.setDone(true);
        todo.setCompletedAt(OffsetDateTime.parse("2026-01-20T10:00:00.000Z"));
        todo.setArchived(false);
        todo.setCreatedAt(OffsetDateTime.parse("2026-01-01T08:30:00.000Z"));
        return todo;
    }
}
