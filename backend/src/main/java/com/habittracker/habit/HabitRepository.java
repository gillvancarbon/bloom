package com.habittracker.habit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HabitRepository extends JpaRepository<Habit, Long> {

    /** Manual order first, then newest — so a freshly added habit lands on top. */
    List<Habit> findAllByOrderBySortOrderAscCreatedAtDesc();

    @Query("select min(h.sortOrder) from Habit h")
    Integer findMinSortOrder();
}
