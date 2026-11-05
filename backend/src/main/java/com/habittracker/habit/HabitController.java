package com.habittracker.habit;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/habits", "/api/v1/habits"})
@CrossOrigin(origins = "http://localhost:5173")
public class HabitController {

    private final HabitService habitService;

    public HabitController(HabitService habitService) {
        this.habitService = habitService;
    }

    @GetMapping
    public List<Habit> getAllHabits() {
        return habitService.getAllHabits();
    }

    @GetMapping("/{id}")
    public Habit getHabitById(@PathVariable Long id) {
        return habitService.getHabitById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Habit createHabit(@Valid @RequestBody Habit habit) {
        return habitService.createHabit(habit);
    }

    @PutMapping("/{id}")
    public Habit updateHabit(@PathVariable Long id, @Valid @RequestBody Habit habit) {
        return habitService.updateHabit(id, habit);
    }

    /** Persist a drag-to-reorder sequence: { "ids": [3, 1, 2] }. */
    @PutMapping("/order")
    public List<Habit> reorder(@RequestBody Map<String, List<Long>> body) {
        return habitService.reorder(body.get("ids"));
    }

    /** Archive or restore a habit. Body: { "archived": true }. */
    @PostMapping("/{id}/archive")
    public Habit archive(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        return habitService.setArchived(id, Boolean.TRUE.equals(body.get("archived")));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHabit(@PathVariable Long id) {
        habitService.deleteHabit(id);
    }

    @PostMapping("/{id}/streak/increment")
    public Habit incrementStreak(@PathVariable Long id) {
        return habitService.incrementStreak(id);
    }

    @PostMapping("/{id}/streak/decrement")
    public Habit decrementStreak(@PathVariable Long id) {
        return habitService.decrementStreak(id);
    }

    @PostMapping("/{id}/streak/toggle")
    public Habit toggleToday(@PathVariable Long id) {
        return habitService.toggleToday(id);
    }
}
