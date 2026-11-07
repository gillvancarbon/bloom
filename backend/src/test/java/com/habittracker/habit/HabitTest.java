package com.habittracker.habit;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Plain unit tests for the richer habit model. No Spring context, so they run
 * in milliseconds and guard the JSON shape the frontend depends on.
 */
class HabitTest {

    @Test
    void scheduleDefaultsToDaily() {
        Habit habit = new Habit();
        assertEquals("daily", habit.getSchedule().get("type"));
    }

    @Test
    void weekdaysRoundTrip() {
        Habit habit = new Habit();
        habit.setSchedule(Map.<String, Object>of("type", "weekdays", "days", List.of(1, 3, 5)));

        Map<String, Object> schedule = habit.getSchedule();
        assertEquals("weekdays", schedule.get("type"));
        assertEquals(List.of(1, 3, 5), schedule.get("days"));
    }

    @Test
    void weeklyRoundTrip() {
        Habit habit = new Habit();
        habit.setSchedule(Map.<String, Object>of("type", "weekly", "perWeek", 4));

        Map<String, Object> schedule = habit.getSchedule();
        assertEquals("weekly", schedule.get("type"));
        assertEquals(4, schedule.get("perWeek"));
    }

    @Test
    void deadlineDefaultsToEndOfDay() {
        assertEquals("23:59", new Habit().getDeadline());
    }

    @Test
    void historyAlwaysIncludesTheLatestCompletion() {
        Habit habit = new Habit();
        habit.setLastCompletedDate(LocalDate.of(2026, 5, 1));
        assertTrue(habit.getHistory().contains("2026-05-01"));
    }

    @Test
    void orderIsExposedUnderItsFriendlyName() {
        Habit habit = new Habit();
        habit.setSortOrder(7);
        assertEquals(7, habit.getOrder());
    }

    @Test
    void timeOfDayRoundTripsIncludingAnytime() {
        Habit habit = new Habit();
        habit.setTimeOfDay("anytime");
        assertEquals("anytime", habit.getTimeOfDay());

        habit.setTimeOfDay("morning");
        assertEquals("morning", habit.getTimeOfDay());
    }

    @Test
    void timeOfDayFallsBackToTheDeadline() {
        Habit habit = new Habit();
        habit.setDeadline("08:00");
        assertEquals("morning", habit.getTimeOfDay());

        habit.setDeadline("14:00");
        assertEquals("afternoon", habit.getTimeOfDay());

        habit.setDeadline("23:00");
        assertEquals("evening", habit.getTimeOfDay());

        // An unknown value is cleared, so the deadline decides the period.
        habit.setDeadline("14:00");
        habit.setTimeOfDay("nonsense");
        assertEquals("afternoon", habit.getTimeOfDay());
    }

    @Test
    void targetDefaultsToOneAndRoundTrips() {
        Habit habit = new Habit();
        assertEquals(1, habit.getTarget());
        habit.setTarget(3);
        assertEquals(3, habit.getTarget());
    }

    @Test
    void historyAndFrozenRoundTripAsSortedIsoDates() {
        Habit habit = new Habit();
        habit.setHistory(List.of(LocalDate.of(2026, 1, 2), LocalDate.of(2026, 1, 1)));
        habit.setFrozen(List.of(LocalDate.of(2026, 2, 1), LocalDate.of(2026, 1, 15)));

        assertEquals(List.of("2026-01-01", "2026-01-02"), habit.getHistory());
        assertEquals(List.of("2026-01-15", "2026-02-01"), habit.getFrozen());
    }

    @Test
    void undoDoesNotFabricateYesterday() {
        LocalDate today = LocalDate.now();
        LocalDate previous = today.minusDays(3);
        Habit habit = completedHabit(previous, today);

        habit.toggleToday();

        // The real previous completion is restored, not today.minusDays(1).
        assertEquals(previous, habit.getLastCompletedDate());
        assertEquals(3, habit.getStreakCount());
        assertFalse(habit.getHistory().contains(today.toString()));
    }

    @Test
    void decrementAndToggleAgreeOnUndo() {
        LocalDate today = LocalDate.now();
        LocalDate previous = today.minusDays(2);
        Habit viaDecrement = completedHabit(previous, today);
        Habit viaToggle = completedHabit(previous, today);

        viaDecrement.decrementStreak();
        viaToggle.toggleToday();

        assertEquals(viaDecrement.getStreakCount(), viaToggle.getStreakCount());
        assertEquals(viaDecrement.getLastCompletedDate(), viaToggle.getLastCompletedDate());
        assertEquals(previous, viaDecrement.getLastCompletedDate());
    }

    @Test
    void undoWithNoHistoryClearsTheLastCompletion() {
        LocalDate today = LocalDate.now();
        Habit habit = new Habit();
        habit.setHistory(List.of(today));
        habit.setLastCompletedDate(today);
        habit.setStreakCount(1);

        habit.decrementStreak();

        assertNull(habit.getLastCompletedDate());
        assertEquals(0, habit.getStreakCount());
    }

    @Test
    void dailyGraceKeepsTheStreak() {
        LocalDate today = LocalDate.of(2026, 6, 10);
        Habit habit = new Habit();
        habit.setHistory(List.of(today.minusDays(2)));
        habit.setLastCompletedDate(today.minusDays(2));
        habit.setStreakCount(5);

        habit.incrementStreak(today);

        assertEquals(6, habit.getStreakCount());
        assertEquals(today, habit.getLastCompletedDate());
    }

    @Test
    void weekdaysFridayToMondayIsNotAMiss() {
        LocalDate friday = LocalDate.of(2026, 6, 5);
        LocalDate monday = LocalDate.of(2026, 6, 8);
        Habit habit = new Habit();
        habit.setSchedule(Map.<String, Object>of("type", "weekdays", "days", List.of(1, 2, 3, 4, 5)));
        habit.setHistory(List.of(friday));
        habit.setLastCompletedDate(friday);
        habit.setStreakCount(5);

        assertEquals(0, habit.countMissedScheduledOccurrences(friday, monday));
        habit.incrementStreak(monday);
        assertEquals(6, habit.getStreakCount());
    }

    @Test
    void weekdaysMissingOneScheduledDayCountsAsOneMiss() {
        LocalDate monday = LocalDate.of(2026, 6, 8);
        LocalDate wednesday = LocalDate.of(2026, 6, 10);
        Habit habit = new Habit();
        habit.setSchedule(Map.<String, Object>of("type", "weekdays", "days", List.of(1, 2, 3, 4, 5)));
        habit.setHistory(List.of(monday));
        habit.setLastCompletedDate(monday);
        habit.setStreakCount(5);

        assertEquals(1, habit.countMissedScheduledOccurrences(monday, wednesday));
        habit.incrementStreak(wednesday);
        assertEquals(6, habit.getStreakCount());
    }

    @Test
    void twoMissedScheduledDaysResetTheStreak() {
        LocalDate today = LocalDate.of(2026, 6, 10);
        Habit habit = new Habit();
        habit.setHistory(List.of(today.minusDays(3)));
        habit.setLastCompletedDate(today.minusDays(3));
        habit.setStreakCount(5);

        habit.incrementStreak(today);

        assertEquals(1, habit.getStreakCount());
    }

    @Test
    void frozenDaysDoNotCountAsMissed() {
        LocalDate today = LocalDate.of(2026, 6, 10);
        Habit habit = new Habit();
        habit.setHistory(List.of(today.minusDays(3)));
        habit.setFrozen(List.of(today.minusDays(2), today.minusDays(1)));
        habit.setLastCompletedDate(today.minusDays(3));
        habit.setStreakCount(5);

        habit.incrementStreak(today);

        assertEquals(6, habit.getStreakCount());
    }

    private Habit completedHabit(LocalDate previous, LocalDate today) {
        Habit habit = new Habit();
        habit.setHistory(List.of(previous, today));
        habit.setLastCompletedDate(today);
        habit.setStreakCount(4);
        return habit;
    }
}
