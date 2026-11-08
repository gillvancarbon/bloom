package com.habittracker.habit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class HabitService {

    private final HabitRepository habitRepository;

    public HabitService(HabitRepository habitRepository) {
        this.habitRepository = habitRepository;
    }

    public List<Habit> getAllHabits() {
        return habitRepository.findAllByOrderBySortOrderAscCreatedAtDesc();
    }

    public Habit getHabitById(Long id) {
        return habitRepository.findById(id)
                .orElseThrow(() -> new HabitNotFoundException("Habit not found with id: " + id));
    }

    public Habit createHabit(Habit habit) {
        // A create always inserts a new row: clearing the identity stops a
        // supplied id from making Spring Data merge onto an existing habit, and
        // the fields below are server-owned, so they reset to new-habit defaults.
        habit.setId(null);
        habit.setStreakCount(0);
        habit.setLastCompletedDate(null);
        habit.setHistory(null);
        habit.setFrozen(null);
        habit.setArchived(false);
        habit.setCreatedAt(null);
        // Keep the existing "newest first" feel: a new habit sorts above the rest.
        Integer min = habitRepository.findMinSortOrder();
        habit.setSortOrder(min == null ? 0 : min - 1);
        return habitRepository.save(habit);
    }

    public Habit updateHabit(Long id, Habit updatedHabit) {
        Habit existing = getHabitById(id);
        existing.setName(updatedHabit.getName());
        existing.setColorIndex(updatedHabit.getColorIndex());
        existing.setDeadline(updatedHabit.getDeadline());
        existing.setSchedule(updatedHabit.getSchedule());
        existing.setCategory(updatedHabit.getCategory());
        existing.setTimeOfDay(updatedHabit.getTimeOfDay());
        existing.setTarget(updatedHabit.getTarget());
        existing.setReminderOffset(updatedHabit.getReminderOffset());
        return habitRepository.save(existing);
    }

    /** Persist a new manual order from the given id sequence. */
    public List<Habit> reorder(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            // Nothing to reorder — leave every habit exactly where it was.
            return getAllHabits();
        }
        for (Long id : ids) {
            if (id == null) {
                throw new IllegalArgumentException("Reorder ids must not be null");
            }
        }
        if (new HashSet<>(ids).size() != ids.size()) {
            throw new IllegalArgumentException("Reorder ids must be unique");
        }

        // Load the whole set in one query, then write the new order back in one
        // batch instead of a find/save round-trip per habit.
        Map<Long, Habit> byId = new HashMap<>();
        for (Habit habit : habitRepository.findAllById(ids)) {
            byId.put(habit.getId(), habit);
        }
        List<Habit> reordered = new ArrayList<>(ids.size());
        for (int i = 0; i < ids.size(); i++) {
            Habit habit = byId.get(ids.get(i));
            if (habit == null) {
                throw new HabitNotFoundException("Habit not found with id: " + ids.get(i));
            }
            habit.setSortOrder(i);
            reordered.add(habit);
        }
        habitRepository.saveAll(reordered);
        return getAllHabits();
    }

    /** Move a habit to or from the archive without losing its history. */
    public Habit setArchived(Long id, boolean archived) {
        Habit habit = getHabitById(id);
        habit.setArchived(archived);
        return habitRepository.save(habit);
    }

    public void deleteHabit(Long id) {
        Habit existing = getHabitById(id);
        habitRepository.delete(existing);
    }

    public Habit incrementStreak(Long id) {
        Habit habit = getHabitById(id);
        habit.incrementStreak();
        return habitRepository.save(habit);
    }

    public Habit decrementStreak(Long id) {
        Habit habit = getHabitById(id);
        habit.decrementStreak();
        return habitRepository.save(habit);
    }

    public Habit toggleToday(Long id) {
        Habit habit = getHabitById(id);
        habit.toggleToday();
        return habitRepository.save(habit);
    }
}
