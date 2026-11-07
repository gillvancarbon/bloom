package com.habittracker.habit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class TodoService {

    private final TodoRepository todoRepository;

    public TodoService(TodoRepository todoRepository) {
        this.todoRepository = todoRepository;
    }

    /**
     * Open tasks first, sorted by due date (undated last), then newest first.
     * Completed tasks sink to the bottom, newest completion first.
     */
    public List<Todo> getAllTodos() {
        List<Todo> todos = new ArrayList<>(todoRepository.findAllByOrderByCreatedAtDesc());
        todos.sort(Comparator
                .comparing(Todo::isArchived)
                .thenComparing(Todo::isDone)
                .thenComparing(todo -> todo.getDueDate() == null ? LocalDate.MAX : todo.getDueDate())
                .thenComparing(Todo::getDueTime, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Todo::getCreatedAt, Comparator.reverseOrder()));
        return todos;
    }

    public Todo getTodoById(Long id) {
        return todoRepository.findById(id)
                .orElseThrow(() -> new TodoNotFoundException("Task not found with id: " + id));
    }

    public Todo createTodo(Todo todo) {
        normalize(todo);
        todo.setDone(false);
        todo.setCompletedAt(null);
        todo.setArchived(false);
        return todoRepository.save(todo);
    }

    public Todo updateTodo(Long id, Todo updated) {
        Todo existing = getTodoById(id);
        existing.setTitle(updated.getTitle() == null ? null : updated.getTitle().trim());
        existing.setNote(cleanNote(updated.getNote()));
        existing.setCategory(cleanCategory(updated.getCategory()));
        existing.setImportance(cleanImportance(updated.getImportance()));
        existing.setRecurrence(cleanRecurrence(updated.getRecurrence()));
        existing.setSubtasks(cleanSubtasks(updated.getSubtasks()));
        existing.setDueDate(updated.getDueDate());
        existing.setDueTime(updated.getDueDate() == null ? null : updated.getDueTime());
        return todoRepository.save(existing);
    }

    public Todo setArchived(Long id, boolean archived) {
        Todo todo = getTodoById(id);
        todo.setArchived(archived);
        return todoRepository.save(todo);
    }

    public void deleteTodo(Long id) {
        Todo existing = getTodoById(id);
        todoRepository.delete(existing);
    }

    public Todo toggleTodo(Long id) {
        Todo todo = getTodoById(id);

        // A repeating task rolls forward to its next occurrence instead of
        // staying done, so a recurring chore never piles up as overdue.
        if (!todo.isDone() && !"none".equals(todo.getRecurrence())) {
            todo.setDueDate(nextOccurrence(todo.getDueDate(), todo.getRecurrence()));
            todo.setDone(false);
            todo.setCompletedAt(null);
            return todoRepository.save(todo);
        }

        todo.toggle();
        return todoRepository.save(todo);
    }

    /** The next future date for a repeating task (skips past-due occurrences). */
    private LocalDate nextOccurrence(LocalDate dueDate, String recurrence) {
        LocalDate today = LocalDate.now();
        LocalDate next = dueDate == null ? today : dueDate;
        int guard = 0;
        do {
            next = switch (recurrence) {
                case "daily" -> next.plusDays(1);
                case "weekly" -> next.plusWeeks(1);
                case "monthly" -> nextMonthly(next);
                default -> next.plusDays(1);
            };
            guard++;
        } while (!next.isAfter(today) && guard < 1000);
        return next;
    }

    /**
     * The next monthly date without drifting at month ends. A month-end date
     * (Jan 31) rolls to the next month's last day (Feb 28, then Mar 31) rather
     * than being clamped and staying there; other dates keep their day, clamped
     * to the target month's length.
     */
    static LocalDate nextMonthly(LocalDate date) {
        LocalDate next = date.plusMonths(1);
        if (date.getDayOfMonth() == date.lengthOfMonth()) {
            return next.withDayOfMonth(next.lengthOfMonth());
        }
        return next;
    }

    private void normalize(Todo todo) {
        if (todo.getTitle() != null) {
            todo.setTitle(todo.getTitle().trim());
        }
        todo.setNote(cleanNote(todo.getNote()));
        todo.setCategory(cleanCategory(todo.getCategory()));
        todo.setImportance(cleanImportance(todo.getImportance()));
        todo.setRecurrence(cleanRecurrence(todo.getRecurrence()));
        todo.setSubtasks(cleanSubtasks(todo.getSubtasks()));
        if (todo.getDueDate() == null) {
            todo.setDueTime(null);
        }
    }

    private String cleanNote(String note) {
        if (note == null) {
            return null;
        }
        String trimmed = note.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String cleanCategory(String category) {
        return (category == null || category.isBlank()) ? "personal" : category;
    }

    private String cleanImportance(String importance) {
        return (importance == null || importance.isBlank()) ? "medium" : importance;
    }

    private String cleanRecurrence(String recurrence) {
        return (recurrence == null || recurrence.isBlank()) ? "none" : recurrence;
    }

    /** Trim step titles, drop blanks, and make sure every step has an id. */
    private List<Subtask> cleanSubtasks(List<Subtask> subtasks) {
        if (subtasks == null) {
            return new ArrayList<>();
        }
        List<Subtask> cleaned = new ArrayList<>();
        for (Subtask subtask : subtasks) {
            if (subtask == null || subtask.getTitle() == null) continue;
            String title = subtask.getTitle().trim();
            if (title.isEmpty()) continue;
            String id = (subtask.getId() == null || subtask.getId().isBlank())
                    ? UUID.randomUUID().toString()
                    : subtask.getId();
            cleaned.add(new Subtask(id, title, subtask.isDone()));
        }
        return cleaned;
    }
}
