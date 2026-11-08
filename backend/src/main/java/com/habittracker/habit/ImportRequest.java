package com.habittracker.habit;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * The JSON body of a data import. Kept as an explicit DTO (rather than the JPA
 * entities) so the wire shape is stable and every imported field is honoured —
 * including the ones a normal "new item" create would drop.
 */
public class ImportRequest {

    @Valid
    private List<HabitImport> habits;

    @Valid
    private List<TodoImport> todos;

    public List<HabitImport> getHabits() {
        return habits;
    }

    public void setHabits(List<HabitImport> habits) {
        this.habits = habits;
    }

    public List<TodoImport> getTodos() {
        return todos;
    }

    public void setTodos(List<TodoImport> todos) {
        this.todos = todos;
    }

    /** Schedule sub-object: { "type": "weekdays", "days": [1,2,3] } or { "type": "weekly", "perWeek": 3 }. */
    public static class ScheduleImport {
        @Pattern(regexp = "daily|weekdays|weekly", message = "Unknown schedule type")
        private String type;
        private List<Integer> days;
        private Integer perWeek;

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public List<Integer> getDays() {
            return days;
        }

        public void setDays(List<Integer> days) {
            this.days = days;
        }

        public Integer getPerWeek() {
            return perWeek;
        }

        public void setPerWeek(Integer perWeek) {
            this.perWeek = perWeek;
        }
    }

    public static class HabitImport {
        @NotBlank(message = "Habit name is required")
        @Size(max = 100, message = "Habit name must be less than 100 characters")
        private String name;

        @Min(value = 0, message = "colorIndex must not be negative")
        private Integer colorIndex;

        @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "Deadline must be a time in HH:mm format")
        private String deadline;

        @Valid
        private ScheduleImport schedule;

        private String category;
        private String timeOfDay;

        @Min(value = 0, message = "reminderOffset must not be negative")
        private Integer reminderOffset;

        private Integer order;
        private Boolean archived;

        @Min(value = 0, message = "target must not be negative")
        private Integer target;

        @Min(value = 0, message = "streakCount must not be negative")
        private Integer streakCount;

        private LocalDate lastCompletedDate;
        private List<LocalDate> history;
        private List<LocalDate> frozen;
        private OffsetDateTime createdAt;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Integer getColorIndex() {
            return colorIndex;
        }

        public void setColorIndex(Integer colorIndex) {
            this.colorIndex = colorIndex;
        }

        public String getDeadline() {
            return deadline;
        }

        public void setDeadline(String deadline) {
            this.deadline = deadline;
        }

        public ScheduleImport getSchedule() {
            return schedule;
        }

        public void setSchedule(ScheduleImport schedule) {
            this.schedule = schedule;
        }

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }

        public String getTimeOfDay() {
            return timeOfDay;
        }

        public void setTimeOfDay(String timeOfDay) {
            this.timeOfDay = timeOfDay;
        }

        public Integer getReminderOffset() {
            return reminderOffset;
        }

        public void setReminderOffset(Integer reminderOffset) {
            this.reminderOffset = reminderOffset;
        }

        public Integer getOrder() {
            return order;
        }

        public void setOrder(Integer order) {
            this.order = order;
        }

        public Boolean getArchived() {
            return archived;
        }

        public void setArchived(Boolean archived) {
            this.archived = archived;
        }

        public Integer getTarget() {
            return target;
        }

        public void setTarget(Integer target) {
            this.target = target;
        }

        public Integer getStreakCount() {
            return streakCount;
        }

        public void setStreakCount(Integer streakCount) {
            this.streakCount = streakCount;
        }

        public LocalDate getLastCompletedDate() {
            return lastCompletedDate;
        }

        public void setLastCompletedDate(LocalDate lastCompletedDate) {
            this.lastCompletedDate = lastCompletedDate;
        }

        public List<LocalDate> getHistory() {
            return history;
        }

        public void setHistory(List<LocalDate> history) {
            this.history = history;
        }

        public List<LocalDate> getFrozen() {
            return frozen;
        }

        public void setFrozen(List<LocalDate> frozen) {
            this.frozen = frozen;
        }

        public OffsetDateTime getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
        }
    }

    public static class TodoImport {
        @NotBlank(message = "Task title is required")
        @Size(max = 120, message = "Task title must be less than 120 characters")
        private String title;

        @Size(max = 280, message = "Note must be less than 280 characters")
        private String note;

        private String category;
        private LocalDate dueDate;
        @JsonFormat(pattern = "HH:mm")
        private LocalTime dueTime;
        private String importance;
        private String recurrence;
        private List<Subtask> subtasks;
        private Boolean done;
        private OffsetDateTime completedAt;
        private Boolean archived;
        private OffsetDateTime createdAt;

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }

        public LocalDate getDueDate() {
            return dueDate;
        }

        public void setDueDate(LocalDate dueDate) {
            this.dueDate = dueDate;
        }

        public LocalTime getDueTime() {
            return dueTime;
        }

        public void setDueTime(LocalTime dueTime) {
            this.dueTime = dueTime;
        }

        public String getImportance() {
            return importance;
        }

        public void setImportance(String importance) {
            this.importance = importance;
        }

        public String getRecurrence() {
            return recurrence;
        }

        public void setRecurrence(String recurrence) {
            this.recurrence = recurrence;
        }

        public List<Subtask> getSubtasks() {
            return subtasks;
        }

        public void setSubtasks(List<Subtask> subtasks) {
            this.subtasks = subtasks;
        }

        public Boolean getDone() {
            return done;
        }

        public void setDone(Boolean done) {
            this.done = done;
        }

        public OffsetDateTime getCompletedAt() {
            return completedAt;
        }

        public void setCompletedAt(OffsetDateTime completedAt) {
            this.completedAt = completedAt;
        }

        public Boolean getArchived() {
            return archived;
        }

        public void setArchived(Boolean archived) {
            this.archived = archived;
        }

        public OffsetDateTime getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
        }
    }
}
