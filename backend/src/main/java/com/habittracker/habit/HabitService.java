package com.habittracker.habit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

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
        existing.setReminderOffset(updatedHabit.getReminderOffset());
        return habitRepository.save(existing);
    }

    /** Persist a new manual order from the given id sequence. */
    public List<Habit> reorder(List<Long> ids) {
        if (ids != null) {
            for (int i = 0; i < ids.size(); i++) {
                Habit habit = getHabitById(ids.get(i));
                habit.setSortOrder(i);
                habitRepository.save(habit);
            }
        }
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
