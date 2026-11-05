package com.habittracker.habit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;

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
        List<Todo> todos = todoRepository.findAllByOrderByCreatedAtDesc();
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
        todo.toggle();
        return todoRepository.save(todo);
    }

    private void normalize(Todo todo) {
        if (todo.getTitle() != null) {
            todo.setTitle(todo.getTitle().trim());
        }
        todo.setNote(cleanNote(todo.getNote()));
        todo.setCategory(cleanCategory(todo.getCategory()));
        todo.setImportance(cleanImportance(todo.getImportance()));
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
}
