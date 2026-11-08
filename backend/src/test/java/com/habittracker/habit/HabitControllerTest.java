package com.habittracker.habit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HTTP contract for the habit endpoints. A real {@link HabitService} is wired
 * over a mocked repository so create/reorder behaviour is exercised end to end
 * (the mocked-service style would not catch mass assignment).
 */
@WebMvcTest(HabitController.class)
@Import(HabitService.class)
class HabitControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private HabitRepository habitRepository;

    private Habit habit(long id, String name) {
        Habit habit = new Habit();
        habit.setId(id);
        habit.setName(name);
        return habit;
    }

    @Test
    void createIgnoresASuppliedIdAndServerOwnedFields() throws Exception {
        when(habitRepository.findMinSortOrder()).thenReturn(null);
        when(habitRepository.save(any(Habit.class))).thenAnswer(invocation -> invocation.getArgument(0));

        mvc.perform(post("/api/habits")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":99,"name":"Read","streakCount":42,
                                 "lastCompletedDate":"2026-01-01",
                                 "history":["2026-01-01"],"frozen":["2026-01-02"],
                                 "archived":true}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(nullValue()))
                .andExpect(jsonPath("$.name").value("Read"))
                .andExpect(jsonPath("$.streakCount").value(0))
                .andExpect(jsonPath("$.lastCompletedDate").value(nullValue()))
                .andExpect(jsonPath("$.archived").value(false))
                .andExpect(jsonPath("$.history").isEmpty())
                .andExpect(jsonPath("$.frozen").isEmpty());
    }

    @Test
    void createRejectsABlankName() throws Exception {
        mvc.perform(post("/api/habits")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.errors.name").value("Habit name is required"));
    }

    @Test
    void updateRejectsAnInvalidDeadline() throws Exception {
        mvc.perform(put("/api/habits/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Read\",\"deadline\":\"25:99\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.errors.deadline").value("Deadline must be a time in HH:mm format"));
    }

    @Test
    void reorderRejectsDuplicateIds() throws Exception {
        mvc.perform(put("/api/habits/order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,1]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"));

        verify(habitRepository, never()).findAllById(any());
    }

    @Test
    void reorderWithNoIdsIsANoOp() throws Exception {
        when(habitRepository.findAllByOrderBySortOrderAscCreatedAtDesc())
                .thenReturn(List.of(habit(1, "Read")));

        mvc.perform(put("/api/habits/order")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Read"));

        verify(habitRepository, never()).saveAll(any());
    }

    @Test
    void archiveMovesAHabitIntoTheArchive() throws Exception {
        Habit existing = habit(1, "Read");
        when(habitRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(habitRepository.save(existing)).thenReturn(existing);

        mvc.perform(post("/api/habits/1/archive")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"archived\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true));
    }

    @Test
    void missingHabitIs404() throws Exception {
        when(habitRepository.findById(404L)).thenReturn(Optional.empty());

        mvc.perform(get("/api/habits/404"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Habit not found with id: 404"));
    }
}
