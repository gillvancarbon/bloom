package com.habittracker.habit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Whole-dataset operations behind the data endpoints: a hard clear, and an
 * atomic import that replaces everything in one transaction so a bad file
 * can never leave the app half-wiped or half-loaded.
 */
@Service
@Transactional
public class DataService {

    private final HabitRepository habitRepository;
    private final TodoRepository todoRepository;
    private final CalendarService calendarService;

    public DataService(HabitRepository habitRepository,
                       TodoRepository todoRepository,
                       CalendarService calendarService) {
        this.habitRepository = habitRepository;
        this.todoRepository = todoRepository;
        this.calendarService = calendarService;
    }

    /** Delete every habit and task, and restart consistency tracking from today. */
    public void clearAll() {
        habitRepository.deleteAll();
        todoRepository.deleteAll();
        calendarService.resetHistoryStart();
    }

    /**
     * Replace the whole dataset with the given snapshot. Validates the request
     * first, then deletes and re-creates inside the surrounding transaction, so
     * any failure rolls back to the previous dataset.
     */
    public void importData(ImportRequest request) {
        if (request == null || request.getHabits() == null || request.getTodos() == null) {
            throw new IllegalArgumentException("Import must include both 'habits' and 'todos' arrays");
        }

        // The surrounding transaction means a failure part-way through rolls the
        // deletes and the partial insert back, restoring the previous dataset.
        habitRepository.deleteAll();
        todoRepository.deleteAll();
        for (ImportRequest.HabitImport imported : request.getHabits()) {
            habitRepository.save(toHabit(imported));
        }
        for (ImportRequest.TodoImport imported : request.getTodos()) {
            todoRepository.save(toTodo(imported));
        }
        calendarService.resetHistoryStart();
    }

    private Habit toHabit(ImportRequest.HabitImport imported) {
        if (imported == null || imported.getName() == null || imported.getName().isBlank()) {
            throw new IllegalArgumentException("Habit name is required");
        }
        Habit habit = new Habit();
        habit.setName(imported.getName().trim());
        habit.setColorIndex(imported.getColorIndex() == null ? 0 : imported.getColorIndex());
        habit.setDeadline(imported.getDeadline());
        applySchedule(habit, imported.getSchedule());
        habit.setCategory(imported.getCategory());
        habit.setTimeOfDay(imported.getTimeOfDay());
        habit.setReminderOffset(imported.getReminderOffset());
        habit.setOrder(imported.getOrder() == null ? 0 : imported.getOrder());
        habit.setArchived(Boolean.TRUE.equals(imported.getArchived()));
        habit.setTarget(imported.getTarget() == null ? 1 : imported.getTarget());
        habit.setStreakCount(imported.getStreakCount() == null ? 0 : imported.getStreakCount());
        habit.setLastCompletedDate(imported.getLastCompletedDate());
        habit.setHistory(imported.getHistory());
        habit.setFrozen(imported.getFrozen());
        habit.setCreatedAt(toLocalDateTime(imported.getCreatedAt()));
        return habit;
    }

    private void applySchedule(Habit habit, ImportRequest.ScheduleImport schedule) {
        if (schedule == null) {
            habit.setSchedule(null);
            return;
        }
        Map<String, Object> map = new HashMap<>();
        map.put("type", schedule.getType());
        if (schedule.getDays() != null) {
            map.put("days", schedule.getDays());
        }
        if (schedule.getPerWeek() != null) {
            map.put("perWeek", schedule.getPerWeek());
        }
        habit.setSchedule(map);
    }

    private Todo toTodo(ImportRequest.TodoImport imported) {
        if (imported == null || imported.getTitle() == null || imported.getTitle().isBlank()) {
            throw new IllegalArgumentException("Task title is required");
        }
        Todo todo = new Todo();
        todo.setTitle(imported.getTitle().trim());
        todo.setNote(imported.getNote());
        todo.setCategory(imported.getCategory());
        todo.setDueDate(imported.getDueDate());
        todo.setDueTime(imported.getDueTime());
        todo.setImportance(imported.getImportance());
        todo.setRecurrence(imported.getRecurrence());
        // Normalise the checklist exactly like a newly created task does.
        todo.setSubtasks(TodoService.cleanSubtasks(imported.getSubtasks()));
        todo.setDone(Boolean.TRUE.equals(imported.getDone()));
        todo.setCompletedAt(toLocalDateTime(imported.getCompletedAt()));
        todo.setArchived(Boolean.TRUE.equals(imported.getArchived()));
        todo.setCreatedAt(toLocalDateTime(imported.getCreatedAt()));
        return todo;
    }

    private LocalDateTime toLocalDateTime(OffsetDateTime value) {
        return value == null ? null : value.toLocalDateTime();
    }
}
