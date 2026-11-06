package com.habittracker.habit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP contract for the to-do endpoints, including validation errors. */
@WebMvcTest(TodoController.class)
class TodoControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private TodoService todoService;

    private Todo todo(long id, String title) {
        Todo todo = new Todo();
        todo.setId(id);
        todo.setTitle(title);
        todo.setCategory("personal");
        todo.setImportance("medium");
        todo.setRecurrence("none");
        todo.setDueDate(LocalDate.of(2026, 11, 6));
        return todo;
    }

    @Test
    void listsTasks() throws Exception {
        when(todoService.getAllTodos()).thenReturn(List.of(todo(1, "Pay rent")));

        mvc.perform(get("/api/todos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].title").value("Pay rent"))
                .andExpect(jsonPath("$[0].importance").value("medium"))
                .andExpect(jsonPath("$[0].recurrence").value("none"));
    }

    @Test
    void createsATask() throws Exception {
        when(todoService.createTodo(any(Todo.class))).thenReturn(todo(7, "Buy milk"));

        mvc.perform(post("/api/todos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Buy milk","category":"errands","importance":"high",
                                 "recurrence":"weekly","dueDate":"2026-11-06"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.title").value("Buy milk"));
    }

    @Test
    void rejectsABlankTitleWithAFieldError() throws Exception {
        mvc.perform(post("/api/todos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"   ","category":"personal"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.errors.title").value("Task title is required"));
    }

    @Test
    void rejectsAnUnknownCategory() throws Exception {
        mvc.perform(post("/api/todos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Something","category":"nonsense"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.category").value("Unknown task type"));
    }

    @Test
    void togglesAndArchives() throws Exception {
        Todo toggled = todo(2, "Stretch");
        toggled.setDone(true);
        when(todoService.toggleTodo(2L)).thenReturn(toggled);
        when(todoService.setArchived(eq(2L), eq(true))).thenReturn(toggled);

        mvc.perform(post("/api/todos/2/toggle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.done").value(true));

        mvc.perform(post("/api/todos/2/archive")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"archived\":true}"))
                .andExpect(status().isOk());
    }

    @Test
    void missingTaskIs404() throws Exception {
        when(todoService.toggleTodo(99L)).thenThrow(new TodoNotFoundException("Task not found with id: 99"));

        mvc.perform(post("/api/todos/99/toggle"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Task not found with id: 99"));
    }
}
