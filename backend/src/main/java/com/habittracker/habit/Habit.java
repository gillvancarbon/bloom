package com.habittracker.habit;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Entity
@Table(name = "habits")
public class Habit {

    private static final String DEFAULT_DEADLINE = "23:59";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Habit name is required")
    @Size(max = 100, message = "Habit name must be less than 100 characters")
    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "streak_count", nullable = false)
    private int streakCount = 0;

    @Column(name = "last_completed_date")
    private LocalDate lastCompletedDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "color_index", nullable = false)
    private int colorIndex = 0;

    /** Daily deadline as "HH:mm" — the time the user aims to finish by. */
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "Deadline must be a time in HH:mm format")
    @Column(name = "deadline", length = 5)
    private String deadline;

    /** Every day this habit was completed — powers the consistency calendar. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "habit_completions", joinColumns = @JoinColumn(name = "habit_id"))
    @Column(name = "completed_date", nullable = false)
    private Set<LocalDate> completedDates = new LinkedHashSet<>();

    /** Repeats: "daily" (default) · "weekdays" · "weekly". */
    @Column(name = "schedule_type", length = 10)
    private String scheduleType;

    /** Comma-separated weekday indices for a "weekdays" schedule (0 = Sunday). */
    @Column(name = "schedule_days", length = 20)
    private String scheduleDays;

    /** Target days per week for a "weekly" schedule. */
    @Column(name = "schedule_per_week")
    private Integer schedulePerWeek;

    /** A soft label such as "Health" or "Mind". */
    @Column(name = "category", length = 40)
    private String category;

    /** Which part of the day the habit belongs to: morning, afternoon, evening. */
    @Column(name = "time_of_day", length = 10)
    private String timeOfDay;

    /** Archived habits keep their history but leave the daily list. */
    @Column(name = "archived", nullable = false, columnDefinition = "boolean default false not null")
    private boolean archived = false;

    /** Manual sort position; lower comes first. */
    @Column(name = "sort_order", nullable = false, columnDefinition = "integer default 0 not null")
    private int sortOrder = 0;

    /** Optional per-habit reminder, as minutes before the deadline. Null = none. */
    @Column(name = "reminder_offset")
    private Integer reminderOffset;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getStreakCount() {
        return streakCount;
    }

    public void setStreakCount(int streakCount) {
        this.streakCount = streakCount;
    }

    public LocalDate getLastCompletedDate() {
        return lastCompletedDate;
    }

    public void setLastCompletedDate(LocalDate lastCompletedDate) {
        this.lastCompletedDate = lastCompletedDate;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public int getColorIndex() {
        return colorIndex;
    }

    public void setColorIndex(int colorIndex) {
        this.colorIndex = colorIndex;
    }

    /** Never returns null, so older rows without a deadline read as end of day. */
    public String getDeadline() {
        return (deadline == null || deadline.isBlank()) ? DEFAULT_DEADLINE : deadline;
    }

    public void setDeadline(String deadline) {
        this.deadline = deadline;
    }

    /**
     * Sorted ISO dates for the calendar. The most recent completion is always
     * included, so habits completed before this feature existed still show up.
     */
    public List<String> getHistory() {
        Set<LocalDate> all = new LinkedHashSet<>(completedDates);
        if (lastCompletedDate != null) {
            all.add(lastCompletedDate);
        }
        return all.stream().map(LocalDate::toString).sorted().collect(Collectors.toList());
    }

    // ── Schedule / organisation (added for the richer habit model) ──────

    /** Schedule as a nested object so the web and on-device shapes match. */
    public Map<String, Object> getSchedule() {
        String type = (scheduleType == null || scheduleType.isBlank()) ? "daily" : scheduleType;
        Map<String, Object> map = new HashMap<>();
        map.put("type", type);
        if ("weekdays".equals(type)) {
            List<Integer> days = new ArrayList<>();
            if (scheduleDays != null && !scheduleDays.isBlank()) {
                for (String part : scheduleDays.split(",")) {
                    try {
                        days.add(Integer.parseInt(part.trim()));
                    } catch (NumberFormatException ignored) {
                        // skip malformed entries
                    }
                }
            }
            map.put("days", days);
        } else if ("weekly".equals(type)) {
            map.put("perWeek", schedulePerWeek != null ? schedulePerWeek : 3);
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    public void setSchedule(Map<String, Object> schedule) {
        if (schedule == null) {
            this.scheduleType = "daily";
            this.scheduleDays = null;
            this.schedulePerWeek = null;
            return;
        }
        Object type = schedule.get("type");
        this.scheduleType = (type instanceof String) ? (String) type : "daily";

        Object days = schedule.get("days");
        if (days instanceof List<?> list) {
            this.scheduleDays = list.stream().map(String::valueOf).collect(Collectors.joining(","));
        } else {
            this.scheduleDays = null;
        }

        Object perWeek = schedule.get("perWeek");
        this.schedulePerWeek = (perWeek instanceof Number n) ? n.intValue() : null;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    /**
     * Never returns null. Older rows without an explicit period fall back to
     * the period their deadline sits in: morning 05:00–11:59, afternoon
     * 12:00–16:59, evening 17:00–04:59.
     */
    public String getTimeOfDay() {
        if ("morning".equals(timeOfDay)
                || "afternoon".equals(timeOfDay)
                || "evening".equals(timeOfDay)
                || "anytime".equals(timeOfDay)) {
            return timeOfDay;
        }
        int minutes;
        try {
            String[] parts = getDeadline().split(":");
            minutes = Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
        } catch (RuntimeException ignored) {
            minutes = 23 * 60 + 59;
        }
        if (minutes >= 5 * 60 && minutes < 12 * 60) {
            return "morning";
        }
        if (minutes >= 12 * 60 && minutes < 17 * 60) {
            return "afternoon";
        }
        return "evening";
    }

    public void setTimeOfDay(String timeOfDay) {
        this.timeOfDay = ("morning".equals(timeOfDay)
                        || "afternoon".equals(timeOfDay)
                        || "evening".equals(timeOfDay)
                        || "anytime".equals(timeOfDay))
                ? timeOfDay
                : null;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    /** Exposed as "order" in JSON to match the web model. */
    public int getOrder() {
        return sortOrder;
    }

    public void setOrder(int order) {
        this.sortOrder = order;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Integer getReminderOffset() {
        return reminderOffset;
    }

    public void setReminderOffset(Integer reminderOffset) {
        this.reminderOffset = reminderOffset;
    }

    // Business logic
    public void incrementStreak() {        LocalDate today = LocalDate.now();
        if (lastCompletedDate == null) {
            // First completion
            this.streakCount = 1;
        } else if (lastCompletedDate.equals(today.minusDays(1))) {
            // Consecutive day
            this.streakCount++;
        } else if (lastCompletedDate.equals(today.minusDays(2))) {
            // One day missed — a single grace day keeps the streak alive.
            this.streakCount++;
        } else if (!lastCompletedDate.equals(today)) {
            // Two or more days missed — streak resets
            this.streakCount = 1;
        }
        // If already completed today, don't change streak
        this.lastCompletedDate = today;
        this.completedDates.add(today);
    }

    public void decrementStreak() {
        if (streakCount > 0) {
            this.streakCount--;
        }
        this.completedDates.remove(LocalDate.now());
        this.lastCompletedDate = null;
    }

    /**
     * Toggles today's completion so an accidental tap can be undone.
     * If today is already marked complete, the streak is rolled back by one
     * and the last completion is treated as yesterday — re-checking restores it.
     * Otherwise this behaves like {@link #incrementStreak()}.
     */
    public void toggleToday() {
        LocalDate today = LocalDate.now();
        if (lastCompletedDate != null && lastCompletedDate.equals(today)) {
            // Undo today's completion
            this.streakCount = Math.max(0, this.streakCount - 1);
            this.lastCompletedDate = this.streakCount > 0 ? today.minusDays(1) : null;
            this.completedDates.remove(today);
        } else {
            incrementStreak();
        }
    }
}