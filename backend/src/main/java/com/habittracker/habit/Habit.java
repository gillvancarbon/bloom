package com.habittracker.habit;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.BatchSize;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
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

    /**
     * Every day this habit was completed — powers the consistency calendar.
     * Kept EAGER so the JSON shape is unchanged, but batched so listing N habits
     * costs a couple of queries instead of one per habit (avoids the N+1).
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @BatchSize(size = 50)
    @CollectionTable(name = "habit_completions", joinColumns = @JoinColumn(name = "habit_id"))
    @Column(name = "completed_date", nullable = false)
    private Set<LocalDate> completedDates = new LinkedHashSet<>();

    /** Days protected by a streak freeze — they keep the streak alive without a completion. */
    @ElementCollection(fetch = FetchType.EAGER)
    @BatchSize(size = 50)
    @CollectionTable(name = "habit_frozen", joinColumns = @JoinColumn(name = "habit_id"))
    @Column(name = "frozen_date", nullable = false)
    private Set<LocalDate> frozen = new LinkedHashSet<>();

    /** How many completions count as a full day (e.g. glasses of water). */
    @Column(name = "target", nullable = false)
    private int target = 1;

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
        // Imported records carry their original timestamp; new ones get "now".
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
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

    /**
     * Replace the completion history outright. Used by import, which trusts the
     * snapshot — unlike {@link #getHistory()} this does not fold in
     * {@code lastCompletedDate}.
     */
    public void setHistory(Collection<LocalDate> dates) {
        this.completedDates = dates == null ? new LinkedHashSet<>() : new LinkedHashSet<>(dates);
    }

    /** Sorted ISO dates of streak-freeze days, so the web model stays parallel to {@link #getHistory()}. */
    public List<String> getFrozen() {
        return frozen.stream().map(LocalDate::toString).sorted().collect(Collectors.toList());
    }

    /** Replace the freeze set outright. Used by import. */
    public void setFrozen(Collection<LocalDate> dates) {
        this.frozen = dates == null ? new LinkedHashSet<>() : new LinkedHashSet<>(dates);
    }

    /** Raw freeze dates for streak maths. Not a bean property, so Jackson leaves it out. */
    Set<LocalDate> frozenDates() {
        return frozen;
    }

    public int getTarget() {
        return target;
    }

    public void setTarget(int target) {
        this.target = target;
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

    /** Mark today complete, honouring the habit's schedule and single grace day. */
    public void incrementStreak() {
        incrementStreak(LocalDate.now());
    }

    /** Testable core of {@link #incrementStreak()} with an explicit "today". */
    void incrementStreak(LocalDate today) {
        if (today.equals(lastCompletedDate)) {
            // Already completed today — nothing to change.
            this.completedDates.add(today);
            return;
        }
        int missed = lastCompletedDate == null ? 0 : countMissedScheduledOccurrences(lastCompletedDate, today);
        if (lastCompletedDate == null) {
            // First completion
            this.streakCount = 1;
        } else if (missed >= 2) {
            // Two or more scheduled occurrences missed — streak resets.
            this.streakCount = 1;
        } else {
            // On time, or a single grace occurrence was missed.
            this.streakCount++;
        }
        this.lastCompletedDate = today;
        this.completedDates.add(today);
    }

    /**
     * Undo today's completion. The streak drops by one (never below zero) and
     * {@code lastCompletedDate} falls back to the most recent real completion,
     * which may be {@code null} if there is no history left.
     */
    public void decrementStreak() {
        LocalDate today = LocalDate.now();
        if (lastCompletedDate == null || !lastCompletedDate.equals(today)) {
            // Today was never completed — nothing legitimate to undo.
            return;
        }
        this.completedDates.remove(today);
        this.streakCount = Math.max(0, this.streakCount - 1);
        this.lastCompletedDate = latestCompletedDate();
    }

    /**
     * Toggles today's completion so an accidental tap can be undone.
     * If today is already marked complete the streak is rolled back by one and
     * {@code lastCompletedDate} is restored to the previous real completion —
     * never a fabricated date. Otherwise this behaves like {@link #incrementStreak()}.
     */
    public void toggleToday() {
        LocalDate today = LocalDate.now();
        if (lastCompletedDate != null && lastCompletedDate.equals(today)) {
            // Undo today's completion.
            this.completedDates.remove(today);
            this.streakCount = Math.max(0, this.streakCount - 1);
            this.lastCompletedDate = latestCompletedDate();
        } else {
            incrementStreak();
        }
    }

    private LocalDate latestCompletedDate() {
        return completedDates.stream().max(LocalDate::compareTo).orElse(null);
    }

    // ── Schedule-aware streak maths ────────────────────────────────────

    /**
     * How many scheduled occurrences were missed strictly between {@code from}
     * and {@code to} (both exclusive). Daily habits count calendar days,
     * weekday habits only their scheduled days, and weekly habits count whole
     * ISO weeks that fell short of the per-week target. For daily and weekday
     * schedules completed and frozen days are never missed; a weekly target is
     * met by completed days only, matching the frontend's {@code completionsThisWeek}.
     *
     * Note: weekly weeks are always ISO/Monday-based here, whereas the frontend
     * honours the user's {@code weekStart} setting. For a non-Monday week start
     * the two can therefore disagree by a day or two at a week boundary.
     */
    int countMissedScheduledOccurrences(LocalDate from, LocalDate to) {
        if (from == null || to == null || !from.isBefore(to)) {
            return 0;
        }
        String type = (scheduleType == null || scheduleType.isBlank()) ? "daily" : scheduleType;
        return switch (type) {
            case "weekdays" -> countMissedDays(from, to, true);
            case "weekly" -> countMissedWeeks(from, to);
            default -> countMissedDays(from, to, false);
        };
    }

    private int countMissedDays(LocalDate from, LocalDate to, boolean scheduledOnly) {
        int missed = 0;
        for (LocalDate day = from.plusDays(1); day.isBefore(to); day = day.plusDays(1)) {
            if (scheduledOnly && !isScheduledWeekday(day)) {
                continue;
            }
            if (completedDates.contains(day) || frozen.contains(day)) {
                continue;
            }
            missed++;
        }
        return missed;
    }

    /** scheduleDays store 0 = Sunday … 6 = Saturday, matching the web model. */
    private boolean isScheduledWeekday(LocalDate day) {
        if (scheduleDays == null || scheduleDays.isBlank()) {
            return false;
        }
        int index = day.getDayOfWeek().getValue() % 7;
        for (String part : scheduleDays.split(",")) {
            try {
                if (Integer.parseInt(part.trim()) == index) {
                    return true;
                }
            } catch (NumberFormatException ignored) {
                // skip malformed entries
            }
        }
        return false;
    }

    private int countMissedWeeks(LocalDate from, LocalDate to) {
        int perWeek = (schedulePerWeek == null || schedulePerWeek < 1) ? 3 : schedulePerWeek;
        LocalDate todayWeekStart = weekStart(to);
        LocalDate previousWeekStart = todayWeekStart.minusWeeks(1);
        LocalDate lastWeekStart = weekStart(from);

        // The last completion is in the current or previous week — on track.
        if (!lastWeekStart.isBefore(previousWeekStart)) {
            return 0;
        }
        // The previous full week hit its target, so nothing has been missed.
        if (completionsInWeek(previousWeekStart) >= perWeek) {
            return 0;
        }

        // Match the web model's one-week grace: the week of the last kept day is
        // never judged, judging starts with the following week.
        int missed = 0;
        for (LocalDate week = lastWeekStart.plusWeeks(1);
                week.isBefore(todayWeekStart);
                week = week.plusWeeks(1)) {
            if (completionsInWeek(week) < perWeek) {
                missed++;
            }
        }
        return missed;
    }

    /**
     * How many times the habit was completed within the ISO week starting
     * {@code weekStart} (always Monday). Frozen days keep the streak alive but do
     * not satisfy a weekly target, so only completed dates count — the same rule
     * as the frontend's {@code completionsThisWeek}, except the frontend anchors
     * weeks to the user's {@code weekStart} setting while this is fixed to ISO/Monday.
     */
    private int completionsInWeek(LocalDate weekStart) {
        int count = 0;
        for (int i = 0; i < 7; i++) {
            if (completedDates.contains(weekStart.plusDays(i))) {
                count++;
            }
        }
        return count;
    }

    /** Monday of the ISO week containing {@code date}. */
    private LocalDate weekStart(LocalDate date) {
        return date.minusDays(date.getDayOfWeek().getValue() - 1L);
    }
}