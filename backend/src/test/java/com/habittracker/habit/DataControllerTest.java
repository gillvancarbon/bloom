package com.habittracker.habit;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP contract for the bulk clear/import endpoints. */
@WebMvcTest(DataController.class)
class DataControllerTest {

    private static final String IMPORT_BODY = """
            {
              "habits": [{
                "name": "Read", "colorIndex": 2, "deadline": "18:00",
                "schedule": {"type":"weekdays","days":[1,2,3,4,5]},
                "category": "Mind", "timeOfDay": "evening", "reminderOffset": 30,
                "order": 3, "archived": false, "target": 1, "streakCount": 12,
                "lastCompletedDate": "2026-01-05",
                "history": ["2026-01-03","2026-01-04","2026-01-05"],
                "frozen": ["2026-01-02"],
                "createdAt": "2026-01-01T08:30:00.000Z"
              }],
              "todos": [{
                "title": "Pay rent", "note": null, "category": "errands",
                "dueDate": "2026-02-01", "dueTime": "09:00", "importance": "high",
                "recurrence": "monthly", "subtasks": [{"id":"s1","title":"Find bill","done":true}],
                "done": true, "completedAt": "2026-01-20T10:00:00.000Z",
                "archived": false, "createdAt": "2026-01-01T08:30:00.000Z"
              }]
            }
            """;

    @Autowired
    private MockMvc mvc;

    @MockBean
    private DataService dataService;

    @Test
    void clearAllReturns204() throws Exception {
        mvc.perform(delete("/api/data"))
                .andExpect(status().isNoContent());

        verify(dataService).clearAll();
    }

    @Test
    void importParsesTheFullSnapshotAndReturns204() throws Exception {
        mvc.perform(post("/api/data/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(IMPORT_BODY))
                .andExpect(status().isNoContent());

        ArgumentCaptor<ImportRequest> captor = ArgumentCaptor.forClass(ImportRequest.class);
        verify(dataService).importData(captor.capture());
        ImportRequest request = captor.getValue();
        assertThat(request.getHabits()).hasSize(1);
        assertThat(request.getTodos()).hasSize(1);

        ImportRequest.HabitImport habit = request.getHabits().get(0);
        assertThat(habit.getName()).isEqualTo("Read");
        assertThat(habit.getTarget()).isEqualTo(1);
        assertThat(habit.getStreakCount()).isEqualTo(12);
        assertThat(habit.getHistory()).containsExactly(
                java.time.LocalDate.of(2026, 1, 3),
                java.time.LocalDate.of(2026, 1, 4),
                java.time.LocalDate.of(2026, 1, 5));
        assertThat(habit.getFrozen()).containsExactly(java.time.LocalDate.of(2026, 1, 2));
        assertThat(habit.getCreatedAt()).isNotNull();

        ImportRequest.TodoImport todo = request.getTodos().get(0);
        assertThat(todo.getTitle()).isEqualTo("Pay rent");
        assertThat(todo.getDone()).isTrue();
        assertThat(todo.getSubtasks()).hasSize(1);
    }

    @Test
    void aRejectedImportMapsTo400() throws Exception {
        doThrow(new IllegalArgumentException("Import must include both 'habits' and 'todos' arrays"))
                .when(dataService).importData(any(ImportRequest.class));

        mvc.perform(post("/api/data/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"habits\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Import must include both 'habits' and 'todos' arrays"));
    }
}
