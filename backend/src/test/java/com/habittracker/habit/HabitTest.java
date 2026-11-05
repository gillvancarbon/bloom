package com.habittracker.habit;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
}
