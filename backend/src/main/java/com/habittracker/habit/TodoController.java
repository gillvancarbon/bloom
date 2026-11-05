package com.habittracker.habit;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/todos", "/api/v1/todos"})
@CrossOrigin(origins = "http://localhost:5173")
public class TodoController {

    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    @GetMapping
    public List<Todo> getAllTodos() {
        return todoService.getAllTodos();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Todo createTodo(@Valid @RequestBody Todo todo) {
        return todoService.createTodo(todo);
    }

    @PutMapping("/{id}")
    public Todo updateTodo(@PathVariable Long id, @Valid @RequestBody Todo todo) {
        return todoService.updateTodo(id, todo);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTodo(@PathVariable Long id) {
        todoService.deleteTodo(id);
    }

    @PostMapping("/{id}/toggle")
    public Todo toggleTodo(@PathVariable Long id) {
        return todoService.toggleTodo(id);
    }

    /** Archive or restore a task. Body: { "archived": true }. */
    @PostMapping("/{id}/archive")
    public Todo archive(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        return todoService.setArchived(id, Boolean.TRUE.equals(body.get("archived")));
    }
}
