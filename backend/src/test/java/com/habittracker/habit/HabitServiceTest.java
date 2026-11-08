package com.habittracker.habit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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

    @Test
    void createForcesANewRowAndResetsServerOwnedFields() {
        when(repository.findMinSortOrder()).thenReturn(null);
        when(repository.save(any(Habit.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Habit input = new Habit();
        input.setId(99L);
        input.setName("Read");
        input.setStreakCount(42);
        input.setLastCompletedDate(LocalDate.of(2026, 1, 1));
        input.setHistory(List.of(LocalDate.of(2026, 1, 1)));
        input.setFrozen(List.of(LocalDate.of(2026, 1, 2)));
        input.setArchived(true);
        input.setCreatedAt(LocalDateTime.of(2020, 1, 1, 0, 0));

        Habit result = service.createHabit(input);

        assertThat(result.getId()).isNull();
        assertThat(result.getStreakCount()).isZero();
        assertThat(result.getLastCompletedDate()).isNull();
        assertThat(result.getHistory()).isEmpty();
        assertThat(result.getFrozen()).isEmpty();
        assertThat(result.isArchived()).isFalse();
        assertThat(result.getCreatedAt()).isNull();
        assertThat(result.getSortOrder()).isZero();
    }

    @Test
    void reorderPersistsTheWholeOrderInOneBatch() {
        Habit first = habit(1L);
        Habit second = habit(2L);
        when(repository.findAllById(List.of(2L, 1L))).thenReturn(List.of(first, second));
        when(repository.findAllByOrderBySortOrderAscCreatedAtDesc()).thenReturn(List.of(second, first));

        service.reorder(List.of(2L, 1L));

        assertThat(second.getSortOrder()).isZero();
        assertThat(first.getSortOrder()).isEqualTo(1);
        verify(repository).saveAll(List.of(second, first));
        verify(repository, never()).save(any(Habit.class));
    }

    @Test
    void reorderRejectsDuplicateIds() {
        assertThatThrownBy(() -> service.reorder(List.of(1L, 1L)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unique");

        verify(repository, never()).findAllById(any());
    }

    @Test
    void reorderWithAnUnknownIdRaisesNotFound() {
        when(repository.findAllById(List.of(7L))).thenReturn(List.of());

        assertThatThrownBy(() -> service.reorder(List.of(7L)))
                .isInstanceOf(HabitNotFoundException.class)
                .hasMessageContaining("7");
    }

    @Test
    void reorderWithNoIdsIsANoOp() {
        when(repository.findAllByOrderBySortOrderAscCreatedAtDesc()).thenReturn(List.of(habit(1L)));

        service.reorder(null);
        service.reorder(List.of());

        verify(repository, never()).saveAll(any());
        verify(repository, never()).findAllById(any());
    }

    private Habit habit(long id) {
        Habit habit = new Habit();
        habit.setId(id);
        habit.setName("Habit " + id);
        return habit;
    }
}
