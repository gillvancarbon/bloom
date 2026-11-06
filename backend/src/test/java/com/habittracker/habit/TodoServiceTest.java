package com.habittracker.habit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the to-do rules the UI depends on: ordering, normalisation,
 * recurrence roll-forward and checklist clean-up. No Spring context needed.
 */
@ExtendWith(MockitoExtension.class)
class TodoServiceTest {

    @Mock
    private TodoRepository repository;

    @InjectMocks
    private TodoService service;

    private Todo task(String title) {
        Todo todo = new Todo();
        todo.setTitle(title);
        todo.setCategory("personal");
        todo.setImportance("medium");
        todo.setRecurrence("none");
        return todo;
    }

    @Test
    void getAllSortsOpenTasksByDueDateThenSinksDoneAndArchived() {
        Todo undated = task("Undated");
        Todo later = task("Later");
        later.setDueDate(LocalDate.of(2026, 11, 10));
        Todo sooner = task("Sooner");
        sooner.setDueDate(LocalDate.of(2026, 11, 6));
        Todo done = task("Done");
        done.setDone(true);
        done.setDueDate(LocalDate.of(2026, 11, 1));
        Todo archived = task("Archived");
        archived.setArchived(true);
        archived.setDueDate(LocalDate.of(2026, 11, 1));

        when(repository.findAllByOrderByCreatedAtDesc())
                .thenReturn(List.of(done, undated, archived, later, sooner));

        assertThat(service.getAllTodos())
                .extracting(Todo::getTitle)
                .containsExactly("Sooner", "Later", "Undated", "Done", "Archived");
    }

    @Test
    void createNormalisesFieldsAndClearsCompletion() {
        Todo input = task("  Water plants  ");
        input.setNote("   ");
        input.setCategory(null);
        input.setImportance("  ");
        input.setRecurrence(null);
        input.setDone(true);
        input.setCompletedAt(LocalDateTime.now());
        input.setArchived(true);
        input.setSubtasks(List.of(
                new Subtask(" ", "  ", false),
                new Subtask("", "  Find the can  ", false)));
        Todo saved = task("Water plants");
        when(repository.save(any(Todo.class))).thenReturn(saved);

        service.createTodo(input);

        ArgumentCaptor<Todo> captor = ArgumentCaptor.forClass(Todo.class);
        verify(repository).save(captor.capture());
        Todo normalised = captor.getValue();
        assertThat(normalised.getTitle()).isEqualTo("Water plants");
        assertThat(normalised.getNote()).isNull();
        assertThat(normalised.getCategory()).isEqualTo("personal");
        assertThat(normalised.getImportance()).isEqualTo("medium");
        assertThat(normalised.getRecurrence()).isEqualTo("none");
        assertThat(normalised.isDone()).isFalse();
        assertThat(normalised.isArchived()).isFalse();
        assertThat(normalised.getCompletedAt()).isNull();
        assertThat(normalised.getSubtasks())
                .extracting(Subtask::getTitle)
                .containsExactly("Find the can");
        assertThat(normalised.getSubtasks().get(0).getId()).isNotBlank();
    }

    @Test
    void updateKeepsIdAndClearsTimeWhenTheDateIsRemoved() {
        Todo existing = task("Old");
        existing.setId(4L);
        existing.setDueDate(LocalDate.of(2026, 11, 6));
        existing.setDueTime(java.time.LocalTime.of(9, 0));
        when(repository.findById(4L)).thenReturn(Optional.of(existing));
        when(repository.save(existing)).thenReturn(existing);

        Todo update = task("  New title  ");
        update.setNote("  keep me  ");
        update.setDueDate(null);
        update.setDueTime(java.time.LocalTime.of(9, 0));

        Todo result = service.updateTodo(4L, update);

        assertThat(result.getId()).isEqualTo(4L);
        assertThat(result.getTitle()).isEqualTo("New title");
        assertThat(result.getNote()).isEqualTo("keep me");
        assertThat(result.getDueDate()).isNull();
        assertThat(result.getDueTime()).isNull();
    }

    @Test
    void toggleCompletesAOneOffTask() {
        Todo todo = task("Post the letter");
        todo.setId(1L);
        when(repository.findById(1L)).thenReturn(Optional.of(todo));
        when(repository.save(todo)).thenReturn(todo);

        Todo result = service.toggleTodo(1L);

        assertThat(result.isDone()).isTrue();
        assertThat(result.getCompletedAt()).isNotNull();

        Todo again = service.toggleTodo(1L);
        assertThat(again.isDone()).isFalse();
        assertThat(again.getCompletedAt()).isNull();
    }

    @Test
    void completingADailyTaskRollsItIntoTheFuture() {
        Todo todo = task("Water plants");
        todo.setId(2L);
        todo.setRecurrence("daily");
        todo.setDueDate(LocalDate.now().minusDays(3));
        when(repository.findById(2L)).thenReturn(Optional.of(todo));
        when(repository.save(todo)).thenReturn(todo);

        Todo result = service.toggleTodo(2L);

        assertThat(result.isDone()).isFalse();
        assertThat(result.getCompletedAt()).isNull();
        assertThat(result.getDueDate()).isAfter(LocalDate.now());
    }

    @Test
    void completingARecurringTaskWithNoDateStartsFromToday() {
        Todo todo = task("Stretch");
        todo.setId(3L);
        todo.setRecurrence("weekly");
        when(repository.findById(3L)).thenReturn(Optional.of(todo));
        when(repository.save(todo)).thenReturn(todo);

        Todo result = service.toggleTodo(3L);

        assertThat(result.getDueDate()).isAfter(LocalDate.now());
        assertThat(result.getDueDate()).isEqualTo(LocalDate.now().plusWeeks(1));
    }

    @Test
    void archivingAndDeletingUseTheStoredRecord() {
        Todo todo = task("Old task");
        todo.setId(5L);
        when(repository.findById(5L)).thenReturn(Optional.of(todo));
        when(repository.save(todo)).thenReturn(todo);

        assertThat(service.setArchived(5L, true).isArchived()).isTrue();
        service.deleteTodo(5L);
        verify(repository).delete(todo);
    }

    @Test
    void missingTaskRaisesNotFound() {
        when(repository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getTodoById(99L))
                .isInstanceOf(TodoNotFoundException.class)
                .hasMessageContaining("99");
    }
}
