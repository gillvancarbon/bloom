package com.habittracker.habit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** Unit tests for the habit rules the editor depends on. No Spring context needed. */
@ExtendWith(MockitoExtension.class)
class HabitServiceTest {

    @Mock
    private HabitRepository repository;

    @InjectMocks
    private HabitService service;

    @Test
    void updatePersistsTimeOfDayAndTarget() {
        Habit existing = new Habit();
        existing.setId(1L);
        existing.setName("Old");
        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(existing)).thenReturn(existing);

        Habit update = new Habit();
        update.setName("Read");
        update.setColorIndex(2);
        update.setDeadline("18:00");
        update.setTimeOfDay("evening");
        update.setTarget(3);

        Habit result = service.updateHabit(1L, update);

        assertThat(result.getName()).isEqualTo("Read");
        assertThat(result.getTimeOfDay()).isEqualTo("evening");
        assertThat(result.getTarget()).isEqualTo(3);
    }
}
